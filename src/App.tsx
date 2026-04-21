import { CareerChat } from '@/components/career-chat';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/components/Login';
import useAuth from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { CareerJobs } from '@/components/career-jobs';
import { StudentProfilePage } from '@/components/student-profile';
import { CareerReportsPage } from '@/components/career-reports';

// 路由守卫
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!user) {
    return <Navigate to='/login' replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<LoginPage />}></Route>
        <Route
          path='/'
          element={
            <PrivateRoute>
              <Layout>
                <CareerChat />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path='/career/jobs'
          element={
            <PrivateRoute>
              <Layout>
                <CareerJobs />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path='/career/profile'
          element={
            <PrivateRoute>
              <Layout>
                <StudentProfilePage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path='/career/reports'
          element={
            <PrivateRoute>
              <Layout>
                <CareerReportsPage />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
