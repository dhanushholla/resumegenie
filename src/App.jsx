import './App.css'
import Panel from './components/Panel'
import { Analytics } from "@vercel/analytics/react"
function App() {

  return (
    <>
      <Panel/>
      <Analytics/>
    </>
  )
}

export default App
