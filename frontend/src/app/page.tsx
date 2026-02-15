import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';
import PortfolioDashboard from '@/components/PortfolioDashboard';

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Chat Interface */}
        <div className="w-1/2 border-r border-border flex flex-col min-w-0">
          <ChatInterface />
        </div>

        {/* Right: Portfolio Dashboard */}
        <div className="w-1/2 flex flex-col min-w-0 bg-background">
          <PortfolioDashboard />
        </div>
      </main>
    </div>
  );
}
