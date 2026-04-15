import { CareerChat } from "@/components/career-chat"
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@/components/login'
import useAuth from '@/hooks/useAuth'

// 路由守卫
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>加载中...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
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
              <CareerChat />
            </PrivateRoute>    
          } />
      </Routes>
    </BrowserRouter>
  )
}

export default App

      // <div className="flex flex-col h-screen">
      //   <CareerChat />
      // </div>
