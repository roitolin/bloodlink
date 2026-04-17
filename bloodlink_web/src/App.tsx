import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import { LandingPage, LoginPage, RegisterPage, VerifyEmailPage } from '@/pages'
import {
  AboutUsPage,
  ContactSupportPage,
  CreateRequestPage,
  DashboardPage,
  DonationHistoryPage,
  FeedbackPage,
  HowToDonatePage,
  MyRequestsPage,
  NotificationsPage,
  ProfilePage,
  RequestDetailPage,
  SearchDonorsPage,
  UserLayout,
} from '@/pages/user'
import {
  AdminAnalyticsPage,
  AdminAnnouncementsPage,
  AdminAuditLogsPage,
  AdminDashboardPage,
  AdminDonorsPage,
  AdminFeedbackPage,
  AdminLayout,
  AdminModerationPage,
  AdminRequestDetailPage,
  AdminRequestsPage,
  AdminSupportPage,
  AdminUserDetailPage,
  AdminUsersPage,
} from '@/pages/admin'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<UserLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="search-donors" element={<SearchDonorsPage />} />
            <Route path="create-request" element={<CreateRequestPage />} />
            <Route path="my-requests" element={<MyRequestsPage />} />
            <Route path="my-requests/:id" element={<RequestDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="about" element={<AboutUsPage />} />
            <Route path="how-to-donate" element={<HowToDonatePage />} />
            <Route path="contact" element={<ContactSupportPage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="donation-history" element={<DonationHistoryPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} redirectUnauthorizedTo="/app" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="requests" element={<AdminRequestsPage />} />
            <Route path="requests/:id" element={<AdminRequestDetailPage />} />
            <Route path="donors" element={<AdminDonorsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="announcements" element={<AdminAnnouncementsPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
