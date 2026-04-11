import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import CompleteProfile from "@/pages/complete-profile";
import Dashboard from "@/pages/dashboard";
import Book from "@/pages/book";
import History from "@/pages/history";
import MapPage from "@/pages/map";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminBookings from "@/pages/admin-bookings";
import AdminDriverManagement from "@/pages/admin-driver-management";
import AdminPickupTerminals from "@/pages/admin-pickup-terminals";
import AdminSchedule from "@/pages/admin-schedule";
import DriverDashboard from "@/pages/driver";
import Notifications from "@/pages/notifications";
import MyRide from "@/pages/my-ride";
import Profile from "@/pages/profile";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/complete-profile" component={CompleteProfile} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/book" component={Book} />
        <Route path="/history" component={History} />
        <Route path="/my-ride" component={MyRide} />
        <Route path="/map" component={MapPage} />
        <Route path="/admin/bookings" component={AdminBookings} />
        <Route path="/admin/drivers" component={AdminDriverManagement} />
        <Route path="/admin/terminals" component={AdminPickupTerminals} />
        <Route path="/admin/schedule" component={AdminSchedule} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/driver" component={DriverDashboard} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
