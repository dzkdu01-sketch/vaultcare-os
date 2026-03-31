import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'

function App() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </div>
  )
}

export default App
