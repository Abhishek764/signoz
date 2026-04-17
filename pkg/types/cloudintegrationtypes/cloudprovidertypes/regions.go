package cloudprovidertypes

import (
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type CloudProviderRegion struct{ valuer.String }

var ErrCodeInvalidServiceID = errors.MustNewCode("invalid_service_id")

var (
	// AWS regions.
	AWSRegionAFSouth1     = CloudProviderRegion{valuer.NewString("af-south-1")}     // Africa (Cape Town).
	AWSRegionAPEast1      = CloudProviderRegion{valuer.NewString("ap-east-1")}      // Asia Pacific (Hong Kong).
	AWSRegionAPNortheast1 = CloudProviderRegion{valuer.NewString("ap-northeast-1")} // Asia Pacific (Tokyo).
	AWSRegionAPNortheast2 = CloudProviderRegion{valuer.NewString("ap-northeast-2")} // Asia Pacific (Seoul).
	AWSRegionAPNortheast3 = CloudProviderRegion{valuer.NewString("ap-northeast-3")} // Asia Pacific (Osaka).
	AWSRegionAPSouth1     = CloudProviderRegion{valuer.NewString("ap-south-1")}     // Asia Pacific (Mumbai).
	AWSRegionAPSouth2     = CloudProviderRegion{valuer.NewString("ap-south-2")}     // Asia Pacific (Hyderabad).
	AWSRegionAPSoutheast1 = CloudProviderRegion{valuer.NewString("ap-southeast-1")} // Asia Pacific (Singapore).
	AWSRegionAPSoutheast2 = CloudProviderRegion{valuer.NewString("ap-southeast-2")} // Asia Pacific (Sydney).
	AWSRegionAPSoutheast3 = CloudProviderRegion{valuer.NewString("ap-southeast-3")} // Asia Pacific (Jakarta).
	AWSRegionAPSoutheast4 = CloudProviderRegion{valuer.NewString("ap-southeast-4")} // Asia Pacific (Melbourne).
	AWSRegionCACentral1   = CloudProviderRegion{valuer.NewString("ca-central-1")}   // Canada (Central).
	AWSRegionCAWest1      = CloudProviderRegion{valuer.NewString("ca-west-1")}      // Canada West (Calgary).
	AWSRegionEUCentral1   = CloudProviderRegion{valuer.NewString("eu-central-1")}   // Europe (Frankfurt).
	AWSRegionEUCentral2   = CloudProviderRegion{valuer.NewString("eu-central-2")}   // Europe (Zurich).
	AWSRegionEUNorth1     = CloudProviderRegion{valuer.NewString("eu-north-1")}     // Europe (Stockholm).
	AWSRegionEUSouth1     = CloudProviderRegion{valuer.NewString("eu-south-1")}     // Europe (Milan).
	AWSRegionEUSouth2     = CloudProviderRegion{valuer.NewString("eu-south-2")}     // Europe (Spain).
	AWSRegionEUWest1      = CloudProviderRegion{valuer.NewString("eu-west-1")}      // Europe (Ireland).
	AWSRegionEUWest2      = CloudProviderRegion{valuer.NewString("eu-west-2")}      // Europe (London).
	AWSRegionEUWest3      = CloudProviderRegion{valuer.NewString("eu-west-3")}      // Europe (Paris).
	AWSRegionILCentral1   = CloudProviderRegion{valuer.NewString("il-central-1")}   // Israel (Tel Aviv).
	AWSRegionMECentral1   = CloudProviderRegion{valuer.NewString("me-central-1")}   // Middle East (UAE).
	AWSRegionMESouth1     = CloudProviderRegion{valuer.NewString("me-south-1")}     // Middle East (Bahrain).
	AWSRegionSAEast1      = CloudProviderRegion{valuer.NewString("sa-east-1")}      // South America (Sao Paulo).
	AWSRegionUSEast1      = CloudProviderRegion{valuer.NewString("us-east-1")}      // US East (N. Virginia).
	AWSRegionUSEast2      = CloudProviderRegion{valuer.NewString("us-east-2")}      // US East (Ohio).
	AWSRegionUSWest1      = CloudProviderRegion{valuer.NewString("us-west-1")}      // US West (N. California).
	AWSRegionUSWest2      = CloudProviderRegion{valuer.NewString("us-west-2")}      // US West (Oregon).
)

func Enum() []any {
	return []any{
		AWSRegionAFSouth1, AWSRegionAPEast1, AWSRegionAPNortheast1, AWSRegionAPNortheast2, AWSRegionAPNortheast3,
		AWSRegionAPSouth1, AWSRegionAPSouth2, AWSRegionAPSoutheast1, AWSRegionAPSoutheast2, AWSRegionAPSoutheast3,
		AWSRegionAPSoutheast4, AWSRegionCACentral1, AWSRegionCAWest1, AWSRegionEUCentral1, AWSRegionEUCentral2, AWSRegionEUNorth1,
		AWSRegionEUSouth1, AWSRegionEUSouth2, AWSRegionEUWest1, AWSRegionEUWest2, AWSRegionEUWest3,
		AWSRegionILCentral1, AWSRegionMECentral1, AWSRegionMESouth1, AWSRegionSAEast1, AWSRegionUSEast1, AWSRegionUSEast2,
		AWSRegionUSWest1, AWSRegionUSWest2,
	}
}

var SupportedRegions = map[CloudProviderType][]CloudProviderRegion{
	CloudProviderTypeAWS: {
		AWSRegionAFSouth1, AWSRegionAPEast1, AWSRegionAPNortheast1, AWSRegionAPNortheast2, AWSRegionAPNortheast3,
		AWSRegionAPSouth1, AWSRegionAPSouth2, AWSRegionAPSoutheast1, AWSRegionAPSoutheast2, AWSRegionAPSoutheast3,
		AWSRegionAPSoutheast4, AWSRegionCACentral1, AWSRegionCAWest1, AWSRegionEUCentral1, AWSRegionEUCentral2, AWSRegionEUNorth1,
		AWSRegionEUSouth1, AWSRegionEUSouth2, AWSRegionEUWest1, AWSRegionEUWest2, AWSRegionEUWest3,
		AWSRegionILCentral1, AWSRegionMECentral1, AWSRegionMESouth1, AWSRegionSAEast1, AWSRegionUSEast1, AWSRegionUSEast2,
		AWSRegionUSWest1, AWSRegionUSWest2,
	},
}

func NewAWSRegion(region string) error {
	for _, r := range SupportedRegions[CloudProviderTypeAWS] {
		if r.StringValue() == region {
			return nil
		}
	}

	return errors.NewInvalidInputf(ErrCodeInvalidCloudRegion, "invalid AWS region: %s", region)
}
