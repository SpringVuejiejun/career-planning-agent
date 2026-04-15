import axios from 'axios'

const config = {
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
}

const request = axios.create(config)

request.interceptors.request.use(
    config => {
        const token = localStorage.getItem('access_token')
        if(token){
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    error => {
        return Promise.reject(error)
    }
)


request.interceptors.response.use(
    response => {
        return response.data
    },
    error => {
        if(error.response){
            const { status, data } = error.response 

            if(status === 401){
                localStorage.removeItem('access_token')
                window.location.href = '/login'
            } else return Promise.reject(data?.message || error)
        }
    }
)

export default request