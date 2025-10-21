import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const data = [
  { name: "Nubank", value: 3250.00, color: "#8b5cf6" },
  { name: "Banco do Brasil", value: 2100.00, color: "#eab308" },
  { name: "Itaú", value: 1497.50, color: "#f97316" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const percentage = ((payload[0].value / total) * 100).toFixed(1);
    
    return (
      <div className="bg-white px-3 py-2 border border-slate-200 rounded-lg shadow-sm">
        <p className="text-slate-900">{payload[0].name}</p>
        <p className="text-slate-600">
          {percentage}% do total
        </p>
      </div>
    );
  }
  return null;
};

export function BankChart() {
  // Altura dinâmica para acomodar gráfico + legendas sem overflow
  // 320px base + (número de itens * 24px para cada linha de legenda)
  const chartHeight = 320 + (data.length * 24);

  return (
    <div className="w-full" style={{ height: `${chartHeight}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={90}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            formatter={(value, entry: any) => (
              <span className="text-slate-700">
                {value}: R$ {entry.payload.value.toFixed(2).replace('.', ',')}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
