import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { sendVerificationCode, LoginWithCode } from '@/apis/auth';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [isSend, setIsSend] = useState(false);

  // 验证邮箱格式
  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return '请输入邮箱';
    if (!regex.test(email)) return '请输入有效的邮箱地址';
    return '';
  };

  const sendCode = async () => {
    const error = validateEmail(email);
    if (error) {
      alert(error);
      return;
    }
    setCodeLoading(true);

    try {
      await sendVerificationCode({ email });
      setCodeLoading(false);
      setIsSend(true);
      setCountdown(60);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      alert('发送失败，请重试');
    } finally {
      setCodeLoading(false);
    }
  };

  const login = async () => {
    if (!email) {
      alert('请输入邮箱');
      return;
    }
    if (!code) {
      alert('请输入验证码');
      return;
    }

    setLoading(true);

    try {
      const result = await LoginWithCode({ email, code });
      localStorage.setItem('access_token', result.access_token);
      window.location.href = '/';
    } catch (error) {
      alert('登录失败，请检查验证码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='w-full max-w-sm m-auto'>
      <CardHeader>
        <CardTitle>欢迎登录 职业规划·智能体</CardTitle>
        <CardDescription>请在下方填入你的邮箱</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className='flex flex-col gap-2'>
            邮箱：
            <div className='gap-2'>
              <Input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='m@example.com'
                required
              />
            </div>
            验证码：
            <div className='grid gap-2 grid-cols-3'>
              <div className='col-span-2'>
                <Input
                  id='code'
                  type='code'
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  placeholder='请输入验证码'
                  required
                />
              </div>
              <Button type='submit' onClick={sendCode}>
                {codeLoading ? (
                  <Loader2 className='animate-spin'></Loader2>
                ) : countdown > 0 ? (
                  `${countdown}s`
                ) : isSend ? (
                  '重新发送'
                ) : (
                  '发送验证码'
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className='flex-col gap-2'>
        <Button className='w-full' onClick={login}>
          {loading ? '登录中' : '登录/注册'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default LoginPage;

if (import.meta.hot) {
  import.meta.hot.accept();
}
