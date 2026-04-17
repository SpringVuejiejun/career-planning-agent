import { useState, useEffect } from 'react';
import { LoginWithCode, sendVerificationCode, getCurrentUserInfo, type UserInfo } from '@/apis/auth';

const useAuth = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  // 检查登录状态
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userInfo = await getCurrentUserInfo();
      setUser(userInfo);
    } catch (error) {
      // Token无效，清除本地存储
      localStorage.removeItem('access_token');
      localStorage.removeItem('is_new_user');
    } finally {
      setLoading(false);
    }
  };

  // 发送验证码
  const sendCode = async (email: string) => {
    const res = await sendVerificationCode({ email });
    return res;
  };

  // 登录
  const login = async (email: string, code: string, username?: string) => {
    const res = await LoginWithCode({ email, code, username });
    
    if (res.access_token) {
      localStorage.setItem('access_token', res.access_token);
      localStorage.setItem('is_new_user', String(res.is_new_user));
      setIsNewUser(res.is_new_user);
      
      // 获取用户信息
      const userInfo = await getCurrentUserInfo();
      setUser(userInfo);
    }
    
    return res;
  };

  // 登出
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('is_new_user');
    setUser(null);
    setIsNewUser(false);
  };

  return {
    user,
    loading,
    isNewUser,
    sendCode,
    login,
    logout,
    checkAuth,
  };
};

export default useAuth