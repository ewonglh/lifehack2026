import { profileForm, bindProfileForm } from './onboarding-page.js';
import { confirmModal } from '../components/modal.js';

export const settingsPage = ({ profile }) => ({
  title: 'Settings',
  content: `${profileForm('Profile and privacy', 'Save changes', profile)}${confirmModal({ id: 'sign-out-modal', title: 'Sign out?', body: '<p>You can sign back in at any time.</p>', confirmLabel: 'Sign out' })}`,
  afterRender: bindProfileForm,
});
