import { useState } from "react";
import { Menu, Plus, LogOut, User, Home, CreditCard, List, Building2, Target, ChevronDown } from "lucide-react";
import { Button } from "./components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./components/ui/sheet";
import { DashboardPage } from "./components/DashboardPage";
import { BanksPage } from "./components/BanksPage";

type Page = "dashboard" | "transacoes" | "categorias" | "bancos" | "metas";

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  const handleLogout = () => {
    console.log("Logout");
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setIsMenuOpen(false);
  };

  const pageTitle: Record<Page, string> = {
    dashboard: "Dashboard",
    transacoes: "Transações",
    categorias: "Categorias",
    bancos: "Bancos",
    metas: "Metas",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col">
                <SheetHeader>
                  <SheetTitle>FinançasPro</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-2 flex-1">
                  <Button
                    variant={currentPage === "dashboard" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => handleNavigate("dashboard")}
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button
                    variant={currentPage === "transacoes" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => handleNavigate("transacoes")}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Transações
                  </Button>
                  <Button
                    variant={currentPage === "categorias" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => handleNavigate("categorias")}
                  >
                    <List className="h-4 w-4 mr-2" />
                    Categorias
                  </Button>
                  <Button
                    variant={currentPage === "bancos" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => handleNavigate("bancos")}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Bancos
                  </Button>
                  <Button
                    variant={currentPage === "metas" ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => handleNavigate("metas")}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Metas
                  </Button>
                </nav>
                
                {/* User Info - Footer do Menu */}
                <div className="mt-auto border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-slate-50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 truncate">Elvis</p>
                      <p className="text-slate-500 truncate">elvis.brandao@exemplo.com</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="text-slate-900">{pageTitle[currentPage]}</h1>
          </div>

          {/* Dropdown Button */}
          <Button variant="outline" size="icon" className="shrink-0">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-7xl mx-auto">
        {currentPage === "dashboard" && <DashboardPage />}
        {currentPage === "bancos" && <BanksPage />}
        {currentPage === "transacoes" && (
          <div className="text-center py-12 text-slate-500">
            Página de Transações em desenvolvimento
          </div>
        )}
        {currentPage === "categorias" && (
          <div className="text-center py-12 text-slate-500">
            Página de Categorias em desenvolvimento
          </div>
        )}
        {currentPage === "metas" && (
          <div className="text-center py-12 text-slate-500">
            Página de Metas em desenvolvimento
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
