import request from '@/utils/request'

export interface SendCodeParams {
    email: string
}

export interface LoginParams {
    email: string,
    code: string,
    username?: string
}

export interface TokenResponse {
    access_token: string,
    is_new_user: string,
    expires_in: number,
    token_type: string
}

export interface UserInfo {
    id: string,
    email: string,
    username: string,
    avatar_url: string,
    last_login: string
}

export const sendVerificationCode = (params: SendCodeParams) => {
    return request.post('/auth/send-code', params)
}

export const LoginWithCode = (params: LoginParams) => {
    return request.post('/auth/login', params) as Promise<TokenResponse>
}

export const getCurrentUserInfo = () => {
    return request.get('/auth/me') as Promise<UserInfo>
}