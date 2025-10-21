import { useState } from "react";
import { Menu, Plus, LogOut, TrendingUp, TrendingDown, Wallet, User } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Progress } from "./components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./components/ui/sheet";
import { Separator } from "./components/ui/separator";
import { CategoryChart } from "./components/CategoryChart";
import { BankChart } from "./components/BankChart";

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Dados mock
  const meta = 10000.00;
  const gasto = 6847.50;
  const progresso = (gasto / meta) * 100;

  const handleLogout = () => {
    console.log("Logout");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 py-4">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2 flex-1">
                <Button variant="ghost" className="justify-start">
                  Dashboard
                </Button>
                <Button variant="ghost" className="justify-start">
                  Transações
                </Button>
                <Button variant="ghost" className="justify-start">
                  Categorias
                </Button>
                <Button variant="ghost" className="justify-start">
                  Bancos
                </Button>
                <Button variant="ghost" className="justify-start">
                  Configurações
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
                    <p className="text-slate-500 truncate">elvis@exemplo.com</p>
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
          <h1 className="text-slate-900">Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-7xl mx-auto">
        {/* Meta Mensal */}
        <Card className="mb-6 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              Meta Mensal de Gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600">Gasto</p>
                  <p className="text-2xl text-slate-900">R$ {gasto.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-600">Meta</p>
                  <p className="text-2xl text-slate-900">R$ {meta.toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Progress value={progresso} className="h-3" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {progresso > 80 ? (
                      <TrendingUp className="h-4 w-4 text-red-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-green-600" />
                    )}
                    <span className={`${progresso > 80 ? 'text-red-600' : 'text-green-600'}`}>
                      {progresso.toFixed(1)}% utilizado
                    </span>
                  </div>
                  <span className="text-slate-600">
                    Restante: R$ {(meta - gasto).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Despesas por Categoria */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart />
            </CardContent>
          </Card>

          {/* Despesas por Banco */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Despesas por Banco</CardTitle>
            </CardHeader>
            <CardContent>
              <BankChart />
            </CardContent>
          </Card>
        </div>
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
