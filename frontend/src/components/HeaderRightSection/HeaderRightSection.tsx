import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Tooltip } from '@signozhq/ui';
import { Popover } from 'antd';
import logEvent from 'api/common/logEvent';
import AIAssistantIcon from 'container/AIAssistant/components/AIAssistantIcon';
import {
	openAIAssistant,
	useAIAssistantStore,
} from 'container/AIAssistant/store/useAIAssistantStore';
import { useGetTenantLicense } from 'hooks/useGetTenantLicense';
import { Globe, Inbox, SquarePen } from 'lucide-react';

import AnnouncementsModal from './AnnouncementsModal';
import FeedbackModal from './FeedbackModal';
import ShareURLModal from './ShareURLModal';

import './HeaderRightSection.styles.scss';

interface HeaderRightSectionProps {
	enableAnnouncements: boolean;
	enableShare: boolean;
	enableFeedback: boolean;
}

function HeaderRightSection({
	enableAnnouncements,
	enableShare,
	enableFeedback,
}: HeaderRightSectionProps): JSX.Element | null {
	const location = useLocation();

	const [openFeedbackModal, setOpenFeedbackModal] = useState(false);
	const [openShareURLModal, setOpenShareURLModal] = useState(false);
	const [openAnnouncementsModal, setOpenAnnouncementsModal] = useState(false);

	const { isCloudUser, isEnterpriseSelfHostedUser } = useGetTenantLicense();

	const handleOpenFeedbackModal = useCallback((): void => {
		logEvent('Feedback: Clicked', {
			page: location.pathname,
		});

		setOpenFeedbackModal(true);
		setOpenShareURLModal(false);
		setOpenAnnouncementsModal(false);
	}, [location.pathname]);

	const handleOpenShareURLModal = useCallback((): void => {
		logEvent('Share: Clicked', {
			page: location.pathname,
		});

		setOpenShareURLModal(true);
		setOpenFeedbackModal(false);
		setOpenAnnouncementsModal(false);
	}, [location.pathname]);

	const handleCloseFeedbackModal = (): void => {
		setOpenFeedbackModal(false);
	};

	const handleOpenFeedbackModalChange = (open: boolean): void => {
		setOpenFeedbackModal(open);
	};

	const handleOpenAnnouncementsModalChange = (open: boolean): void => {
		setOpenAnnouncementsModal(open);
	};

	const handleOpenShareURLModalChange = (open: boolean): void => {
		setOpenShareURLModal(open);
	};

	const isLicenseEnabled = isEnterpriseSelfHostedUser || isCloudUser;
	const isDrawerOpen = useAIAssistantStore((s) => s.isDrawerOpen);

	return (
		<div className="header-right-section-container">
			{!isDrawerOpen && (
				<Tooltip title="AI Assistant">
					<Button
						variant="ghost"
						size="icon"
						onClick={openAIAssistant}
						aria-label="Open AI Assistant"
						prefix={<AIAssistantIcon />}
					/>
				</Tooltip>
			)}

			{enableFeedback && isLicenseEnabled && (
				<Popover
					rootClassName="header-section-popover-root"
					className="shareable-link-popover"
					placement="bottomRight"
					content={<FeedbackModal onClose={handleCloseFeedbackModal} />}
					destroyTooltipOnHide
					arrow={false}
					trigger="click"
					open={openFeedbackModal}
					onOpenChange={handleOpenFeedbackModalChange}
				>
					<Button
						variant="ghost"
						size="icon"
						prefix={<SquarePen size={14} />}
						onClick={handleOpenFeedbackModal}
					/>
				</Popover>
			)}

			{enableAnnouncements && (
				<Popover
					rootClassName="header-section-popover-root"
					className="shareable-link-popover"
					placement="bottomRight"
					content={<AnnouncementsModal />}
					arrow={false}
					destroyTooltipOnHide
					trigger="click"
					open={openAnnouncementsModal}
					onOpenChange={handleOpenAnnouncementsModalChange}
				>
					<Button
						variant="ghost"
						size="icon"
						prefix={<Inbox size={14} />}
						onClick={(): void => {
							logEvent('Announcements: Clicked', {
								page: location.pathname,
							});
						}}
					/>
				</Popover>
			)}

			{enableShare && (
				<Popover
					rootClassName="header-section-popover-root"
					className="shareable-link-popover"
					placement="bottomRight"
					content={<ShareURLModal />}
					open={openShareURLModal}
					destroyTooltipOnHide
					arrow={false}
					trigger="click"
					onOpenChange={handleOpenShareURLModalChange}
				>
					<Button
						variant="ghost"
						size="icon"
						prefix={<Globe size={14} />}
						onClick={handleOpenShareURLModal}
					/>
				</Popover>
			)}
		</div>
	);
}

export default HeaderRightSection;
