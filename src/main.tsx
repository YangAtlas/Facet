import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fortawesome/fontawesome-free/css/all.min.css'
import 'katex/dist/katex.min.css'
import './styles.css'
createRoot(document.getElementById('root')!).render(<App/> )
