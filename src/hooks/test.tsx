import { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react'

export default function Test() {
    const [data, setData] = useState(0)
    const [list, setList] = useState([0,1,2])

    // 副作用函数，有一个数组依赖项
    function testUseEffect() {
        useEffect(() => {
            setData(list.reduce((sum, item) => sum + item, 0))
        }, [list])
    }

    // 缓存计算结果
    function testUseMemo() {
        const sum = useMemo(() => {
            return list.reduce((sum, item) => sum + item, 0)
        }, [list])
        return sum
    }

    // 缓存函数组件，减少不必要的渲染
    const testUseCallback = useCallback(() => {
        console.log(data)
    }, [data])

    // return {
    //     testUseEffect,
    //     testUseMemo,
    //     testUseCallback
    // }

    type Theme = 'light' | 'dark'

    const ThemeContext = createContext(null)
    function ThemeProvider({ children }: { children: React.ReactNode }) {
        const [theme, setTheme] = useState<Theme>('light')

        const toggleTheme = () => {
            setTheme(prev => prev === 'light' ? 'dark' : 'light')
        }

        return (
            <ThemeContext.Provider value={{ theme, toggleTheme }}>
                {children}
            </ThemeContext.Provider>
        )
    }

    // const [state, dispatch] = useReducer(reducer, initialState)

}