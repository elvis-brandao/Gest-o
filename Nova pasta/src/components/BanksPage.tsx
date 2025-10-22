import { useState } from "react";
import { Trash2, Building2, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

export function BanksPage() {
  const [bankName, setBankName] = useState("");
  const [banks, setBanks] = useState([
    { id: 1, name: "C6" },
    { id: 2, name: "Inter" },
    { id: 3, name: "Bradesco" },
  ]);

  const handleAddBank = () => {
    if (bankName.trim()) {
      setBanks([...banks, { id: Date.now(), name: bankName.trim() }]);
      setBankName("");
    }
  };

  const handleDeleteBank = (id: number) => {
    setBanks(banks.filter((bank) => bank.id !== id));
  };

  return (
    <>
      {/* Novo Banco */}
      <Card className="mb-6 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="h-5 w-5 text-slate-700" />
            <h2 className="text-slate-900">Novo Banco</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-slate-600 text-sm mb-1.5 block">Nome</label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddBank()}
                  placeholder="Digite o nome do banco"
                  className="flex-1"
                />
                <Button onClick={handleAddBank} className="shrink-0">
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Bancos */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-5 w-5 text-slate-700" />
            <h2 className="text-slate-900">Bancos</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks.map((bank) => (
              <div
                key={bank.id}
                className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-900">{bank.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteBank(bank.id)}
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {banks.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Nenhum banco cadastrado ainda
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
