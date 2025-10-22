import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { CategoryChart } from "./CategoryChart";
import { BankChart } from "./BankChart";

export function DashboardPage() {
  // Dados mock
  const meta = 10000.00;
  const gasto = 6847.50;
  const progresso = (gasto / meta) * 100;

  return (
    <>
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
    </>
  );
}
