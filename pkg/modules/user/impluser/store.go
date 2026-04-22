package impluser

import (
	"context"
	"database/sql"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/coretypes"
	"github.com/SigNoz/signoz/pkg/types/preferencetypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

type store struct {
	sqlstore sqlstore.SQLStore
	settings factory.ProviderSettings
}

func NewStore(sqlstore sqlstore.SQLStore, settings factory.ProviderSettings) coretypes.UserStore {
	return &store{sqlstore: sqlstore, settings: settings}
}

func (store *store) CreatePassword(ctx context.Context, password *coretypes.FactorPassword) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewInsert().
		Model(password).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, coretypes.ErrPasswordAlreadyExists, "password for user %s already exists", password.UserID)
	}

	return nil
}

func (store *store) CreateUser(ctx context.Context, user *coretypes.User) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewInsert().
		Model(user).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, coretypes.ErrUserAlreadyExists, "user with email %s already exists in org %s", user.Email, user.OrgID)
	}
	return nil
}

func (store *store) GetUser(ctx context.Context, id valuer.UUID) (*coretypes.User, error) {
	user := new(coretypes.User)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(user).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeUserNotFound, "user with id %s does not exist", id)
	}

	return user, nil
}

func (store *store) GetByOrgIDAndID(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*coretypes.User, error) {
	user := new(coretypes.User)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(user).
		Where("org_id = ?", orgID).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeUserNotFound, "user with id %s does not exist", id)
	}

	return user, nil
}

func (store *store) GetNonDeletedUsersByEmailAndOrgID(ctx context.Context, email valuer.Email, orgID valuer.UUID) ([]*coretypes.User, error) {
	var users []*coretypes.User

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(&users).
		Where("org_id = ?", orgID).
		Where("email = ?", email).
		Where("status != ?", coretypes.UserStatusDeleted).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (store *store) UpdateUser(ctx context.Context, orgID valuer.UUID, user *coretypes.User) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewUpdate().
		Model(user).
		Column("display_name").
		Column("email").
		Column("is_root").
		Column("updated_at").
		Column("status").
		Where("org_id = ?", orgID).
		Where("id = ?", user.ID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeUserNotFound, "user does not exist in org: %s", orgID)
	}
	return nil
}

func (store *store) ListUsersByOrgID(ctx context.Context, orgID valuer.UUID) ([]*coretypes.User, error) {
	users := []*coretypes.User{}

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(&users).
		Where("org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (store *store) DeleteUser(ctx context.Context, orgID string, id string) error {
	tx, err := store.sqlstore.BunDB().BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to start transaction")
	}

	defer func() {
		_ = tx.Rollback()
	}()

	// get the password id

	var password coretypes.FactorPassword
	err = tx.NewSelect().
		Model(&password).
		Where("user_id = ?", id).
		Scan(ctx)
	if err != nil && err != sql.ErrNoRows {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete password")
	}

	// delete reset password request
	_, err = tx.NewDelete().
		Model(new(coretypes.ResetPasswordToken)).
		Where("password_id = ?", password.ID.String()).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete reset password request")
	}

	// delete factor password
	_, err = tx.NewDelete().
		Model(new(coretypes.FactorPassword)).
		Where("user_id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete factor password")
	}

	// delete user_preference
	_, err = tx.NewDelete().
		Model(new(preferencetypes.StorableUserPreference)).
		Where("user_id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete user preferences")
	}

	// delete tokens
	_, err = tx.NewDelete().
		Model(new(authtypes.StorableToken)).
		Where("user_id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete tokens")
	}

	// delete user
	_, err = tx.NewDelete().
		Model(new(coretypes.User)).
		Where("org_id = ?", orgID).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete user")
	}

	err = tx.Commit()
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to commit transaction")
	}

	return nil
}

func (store *store) SoftDeleteUser(ctx context.Context, orgID string, id string) error {
	tx, err := store.sqlstore.BunDB().BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to start transaction")
	}

	defer func() {
		_ = tx.Rollback()
	}()

	// get the password id

	var password coretypes.FactorPassword
	err = tx.NewSelect().
		Model(&password).
		Where("user_id = ?", id).
		Scan(ctx)
	if err != nil && err != sql.ErrNoRows {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete password")
	}

	// delete reset password request
	_, err = tx.NewDelete().
		Model(new(coretypes.ResetPasswordToken)).
		Where("password_id = ?", password.ID.String()).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete reset password request")
	}

	// delete factor password
	_, err = tx.NewDelete().
		Model(new(coretypes.FactorPassword)).
		Where("user_id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete factor password")
	}

	// delete user_preference
	_, err = tx.NewDelete().
		Model(new(preferencetypes.StorableUserPreference)).
		Where("user_id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete user preferences")
	}

	// delete tokens
	_, err = tx.NewDelete().
		Model(new(authtypes.StorableToken)).
		Where("user_id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete tokens")
	}

	// soft delete user
	now := time.Now()
	_, err = tx.NewUpdate().
		Model(new(coretypes.User)).
		Set("status = ?", coretypes.UserStatusDeleted).
		Set("updated_at = ?", now).
		Where("org_id = ?", orgID).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete user")
	}

	err = tx.Commit()
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to commit transaction")
	}

	return nil
}

func (store *store) CreateResetPasswordToken(ctx context.Context, resetPasswordToken *coretypes.ResetPasswordToken) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewInsert().
		Model(resetPasswordToken).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, coretypes.ErrResetPasswordTokenAlreadyExists, "reset password token for password  %s already exists", resetPasswordToken.PasswordID)
	}

	return nil
}

func (store *store) GetPassword(ctx context.Context, id valuer.UUID) (*coretypes.FactorPassword, error) {
	password := new(coretypes.FactorPassword)

	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(password).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrPasswordNotFound, "password with id: %s does not exist", id)
	}

	return password, nil
}

func (store *store) GetPasswordByUserID(ctx context.Context, userID valuer.UUID) (*coretypes.FactorPassword, error) {
	password := new(coretypes.FactorPassword)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(password).
		Where("user_id = ?", userID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrPasswordNotFound, "password for user %s does not exist", userID)
	}
	return password, nil
}

func (store *store) GetResetPasswordTokenByPasswordID(ctx context.Context, passwordID valuer.UUID) (*coretypes.ResetPasswordToken, error) {
	resetPasswordToken := new(coretypes.ResetPasswordToken)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(resetPasswordToken).
		Where("password_id = ?", passwordID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrResetPasswordTokenNotFound, "reset password token for password %s does not exist", passwordID)
	}

	return resetPasswordToken, nil
}

func (store *store) GetResetPasswordTokenByOrgIDAndUserID(ctx context.Context, orgID valuer.UUID, userID valuer.UUID) (*coretypes.ResetPasswordToken, error) {
	resetPasswordToken := new(coretypes.ResetPasswordToken)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(resetPasswordToken).
		Join("JOIN factor_password ON factor_password.id = reset_password_token.password_id").
		Join("JOIN users ON users.id = factor_password.user_id").
		Where("factor_password.user_id = ?", userID).
		Where("users.org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrResetPasswordTokenNotFound, "reset password token for user %s does not exist", userID)
	}

	return resetPasswordToken, nil
}

func (store *store) DeleteResetPasswordTokenByPasswordID(ctx context.Context, passwordID valuer.UUID) error {
	_, err := store.sqlstore.BunDBCtx(ctx).NewDelete().
		Model(&coretypes.ResetPasswordToken{}).
		Where("password_id = ?", passwordID).
		Exec(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, errors.CodeInternal, "failed to delete reset password token")
	}

	return nil
}

func (store *store) GetResetPasswordToken(ctx context.Context, token string) (*coretypes.ResetPasswordToken, error) {
	resetPasswordRequest := new(coretypes.ResetPasswordToken)

	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(resetPasswordRequest).
		Where("token = ?", token).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrResetPasswordTokenNotFound, "reset password token does not exist")
	}

	return resetPasswordRequest, nil
}

func (store *store) UpdatePassword(ctx context.Context, factorPassword *coretypes.FactorPassword) error {
	_, err := store.sqlstore.BunDBCtx(ctx).
		NewUpdate().
		Model(factorPassword).
		Where("user_id = ?", factorPassword.UserID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrPasswordNotFound, "password for user %s does not exist", factorPassword.UserID)
	}

	return nil
}

func (store *store) CountByOrgID(ctx context.Context, orgID valuer.UUID) (int64, error) {
	user := new(coretypes.User)

	count, err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(user).
		Where("org_id = ?", orgID).
		Count(ctx)
	if err != nil {
		return 0, err
	}

	return int64(count), nil
}

func (store *store) CountByOrgIDAndStatuses(ctx context.Context, orgID valuer.UUID, statuses []string) (map[valuer.String]int64, error) {
	user := new(coretypes.User)
	var results []struct {
		Status valuer.String `bun:"status"`
		Count  int64         `bun:"count"`
	}

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(user).
		ColumnExpr("status").
		ColumnExpr("COUNT(*) AS count").
		Where("org_id = ?", orgID.StringValue()).
		Where("status IN (?)", bun.In(statuses)).
		GroupExpr("status").
		Scan(ctx, &results)
	if err != nil {
		return nil, err
	}

	counts := make(map[valuer.String]int64, len(results))
	for _, r := range results {
		counts[r.Status] = r.Count
	}

	return counts, nil
}

func (store *store) RunInTx(ctx context.Context, cb func(ctx context.Context) error) error {
	return store.sqlstore.RunInTxCtx(ctx, nil, func(ctx context.Context) error {
		return cb(ctx)
	})
}

func (store *store) GetRootUserByOrgID(ctx context.Context, orgID valuer.UUID) (*coretypes.User, error) {
	user := new(coretypes.User)
	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(user).
		Where("org_id = ?", orgID).
		Where("is_root = ?", true).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeUserNotFound, "root user for org %s not found", orgID)
	}
	return user, nil
}

func (store *store) ListUsersByEmailAndOrgIDs(ctx context.Context, email valuer.Email, orgIDs []valuer.UUID) ([]*coretypes.User, error) {
	users := []*coretypes.User{}
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(&users).
		Where("email = ?", email).
		Where("org_id IN (?)", bun.In(orgIDs)).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (store *store) GetUserByResetPasswordToken(ctx context.Context, token string) (*coretypes.User, error) {
	user := new(coretypes.User)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(user).
		Join(`JOIN factor_password ON factor_password.user_id = "user".id`).
		Join("JOIN reset_password_token ON reset_password_token.password_id = factor_password.id").
		Where("reset_password_token.token = ?", token).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeUserNotFound, "user not found for reset password token")
	}

	return user, nil
}

func (store *store) GetUsersByEmailsOrgIDAndStatuses(ctx context.Context, orgID valuer.UUID, emails []string, statuses []string) ([]*coretypes.User, error) {
	users := []*coretypes.User{}

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(&users).
		Where("email IN (?)", bun.In(emails)).
		Where("org_id = ?", orgID).
		Where("status in (?)", bun.In(statuses)).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (store *store) GetUsersByOrgIDAndRoleID(ctx context.Context, orgID valuer.UUID, roleID valuer.UUID) ([]*coretypes.User, error) {
	users := []*coretypes.User{}

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(&users).
		Join(`JOIN user_role ON user_role.user_id = "users".id`).
		Where(`"users".org_id = ?`, orgID).
		Where("user_role.role_id = ?", roleID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return users, nil
}
