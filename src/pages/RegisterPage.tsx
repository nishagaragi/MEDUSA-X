import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Registration removed — redirect directly to dashboard
export default function RegisterPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/dashboard', { replace: true }) }, [navigate])
  return null
}
