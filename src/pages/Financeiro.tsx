import { useState, useEffect } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Users, Calendar, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart
} from "recharts";
import { getLancamentos, addLancamento, deleteLancamento, getVendas, type Lancamento, type Venda } from "@/lib/mediadores-store";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6"];

export default function Financeiro() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "ganho" as "ganho" | "gasto",
    valor: "",
    categoria: "",
    descricao: "",
  });
  const [periodo, setPeriodo] = useState<"7dias" | "30dias" | "90dias" | "ano">("30dias");

  const loadData = async () => {
    setLoading(true);
    try {
      const [lancamentosData, vendasData] = await Promise.all([
        getLancamentos(),
        getVendas()
      ]);
      setLancamentos(lancamentosData);
      setVendas(vendasData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!form.valor || !form.categoria) {
      toast.error("Preencha valor e categoria");
      return;
    }

    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast.error("Valor inválido");
      return;
    }

    setLoading(true);
    try {
      await addLancamento({
        tipo: form.tipo,
        valor: valor,
        categoria: form.categoria,
        descricao: form.descricao || undefined,
      });
      toast.success("Lançamento adicionado!");
      setForm({ tipo: "ganho", valor: "", categoria: "", descricao: "" });
      setOpen(false);
      await loadData();
    } catch (error: any) {
      console.error("Erro ao adicionar:", error);
      toast.error(error.message || "Erro ao adicionar lançamento");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    
    setLoading(true);
    try {
      await deleteLancamento(id);
      toast.success("Lançamento excluído!");
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir lançamento");
    } finally {
      setLoading(false);
    }
  };

  // Calcular totais
  const totalGanhos = lancamentos
    .filter((l) => l.tipo === "ganho")
    .reduce((sum, l) => sum + l.valor, 0);
  
  const totalGastos = lancamentos
    .filter((l) => l.tipo === "gasto")
    .reduce((sum, l) => sum + l.valor, 0);
  
  const totalVendas = vendas.reduce((sum, v) => sum + v.valor, 0);
  
  const totalReceitas = totalGanhos + totalVendas;
  const saldo = totalReceitas - totalGastos;

  // Dados para gráficos de lançamentos por categoria
  const ganhosPorCategoria = lancamentos
    .filter(l => l.tipo === "ganho")
    .reduce((acc, l) => {
      acc[l.categoria] = (acc[l.categoria] || 0) + l.valor;
      return acc;
    }, {} as Record<string, number>);

  const gastosPorCategoria = lancamentos
    .filter(l => l.tipo === "gasto")
    .reduce((acc, l) => {
      acc[l.categoria] = (acc[l.categoria] || 0) + l.valor;
      return acc;
    }, {} as Record<string, number>);

  const pieGanhosData = Object.entries(ganhosPorCategoria).map(([name, value]) => ({ name, value }));
  const pieGastosData = Object.entries(gastosPorCategoria).map(([name, value]) => ({ name, value }));

  // Dados para gráfico de evolução temporal
  const getDataPorPeriodo = () => {
    const now = new Date();
    let dias = 30;
    if (periodo === "7dias") dias = 7;
    if (periodo === "90dias") dias = 90;
    if (periodo === "ano") dias = 365;
    
    const dataInicio = new Date(now);
    dataInicio.setDate(dataInicio.getDate() - dias);
    
    const lancamentosFiltrados = lancamentos.filter(l => new Date(l.data_lancamento) >= dataInicio);
    const vendasFiltradas = vendas.filter(v => new Date(v.data_venda) >= dataInicio);
    
    // Agrupar por data
    const dataMap = new Map<string, { ganhos: number; gastos: number; vendas: number }>();
    
    lancamentosFiltrados.forEach(l => {
      const date = new Date(l.data_lancamento).toLocaleDateString("pt-BR");
      const current = dataMap.get(date) || { ganhos: 0, gastos: 0, vendas: 0 };
      if (l.tipo === "ganho") {
        current.ganhos += l.valor;
      } else {
        current.gastos += l.valor;
      }
      dataMap.set(date, current);
    });
    
    vendasFiltradas.forEach(v => {
      const date = new Date(v.data_venda).toLocaleDateString("pt-BR");
      const current = dataMap.get(date) || { ganhos: 0, gastos: 0, vendas: 0 };
      current.vendas += v.valor;
      dataMap.set(date, current);
    });
    
    return Array.from(dataMap.entries())
      .map(([date, data]) => ({ 
        date, 
        receitas: data.ganhos + data.vendas,
        gastos: data.gastos 
      }))
      .sort((a, b) => {
        const [aDay, aMonth, aYear] = a.date.split("/");
        const [bDay, bMonth, bYear] = b.date.split("/");
        return new Date(`${aYear}-${aMonth}-${aDay}`).getTime() - new Date(`${bYear}-${bMonth}-${bDay}`).getTime();
      });
  };

  const evolucaoData = getDataPorPeriodo();

  // Vendas por mediador
  const vendasPorMediador = vendas.reduce((acc, v) => {
    acc[v.mediador_nome] = (acc[v.mediador_nome] || 0) + v.valor;
    return acc;
  }, {} as Record<string, number>);

  const vendasMediadorData = Object.entries(vendasPorMediador)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 relative">
      <div className="page-glow" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Financeiro</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-red">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-[90vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Lançamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={form.tipo === "ganho" ? "default" : "outline"}
                    onClick={() => setForm({ ...form, tipo: "ganho" })}
                    className={form.tipo === "ganho" ? "bg-success hover:bg-success/90" : "border-success/30 text-success"}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Ganho
                  </Button>
                  <Button
                    type="button"
                    variant={form.tipo === "gasto" ? "default" : "outline"}
                    onClick={() => setForm({ ...form, tipo: "gasto" })}
                    className={form.tipo === "gasto" ? "bg-destructive hover:bg-destructive/90" : "border-destructive/30 text-destructive"}
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Gasto
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="bg-secondary border-border"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  placeholder="Ex: Salário, Aluguel, Marketing..."
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="Detalhes do lançamento"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>

              <Button onClick={handleAdd} disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? "Adicionando..." : "Adicionar Lançamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
        <motion.div variants={item} className="stat-card">
          <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-success mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-success">{formatCurrency(totalReceitas)}</p>
          <p className="text-[10px] sm:text-sm text-muted-foreground">Total de Receitas</p>
        </motion.div>
        <motion.div variants={item} className="stat-card">
          <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-destructive mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-destructive">{formatCurrency(totalGastos)}</p>
          <p className="text-[10px] sm:text-sm text-muted-foreground">Total de Gastos</p>
        </motion.div>
        <motion.div variants={item} className="stat-card">
          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-chart-4 mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-chart-4">{formatCurrency(totalVendas)}</p>
          <p className="text-[10px] sm:text-sm text-muted-foreground">Vendas de Mediadores</p>
        </motion.div>
        <motion.div variants={item} className="stat-card">
          <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-primary mb-2" />
          <p className={`text-lg sm:text-2xl font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(saldo)}
          </p>
          <p className="text-[10px] sm:text-sm text-muted-foreground">Saldo Total</p>
        </motion.div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Evolução Temporal */}
        <motion.div variants={item} className="glass-card p-4 sm:p-6 glow-red">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold">Evolução Financeira</h2>
            <div className="flex gap-1">
              <Button
                variant={periodo === "7dias" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo("7dias")}
                className={periodo === "7dias" ? "bg-primary" : "border-border"}
              >
                7d
              </Button>
              <Button
                variant={periodo === "30dias" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo("30dias")}
                className={periodo === "30dias" ? "bg-primary" : "border-border"}
              >
                30d
              </Button>
              <Button
                variant={periodo === "90dias" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo("90dias")}
                className={periodo === "90dias" ? "bg-primary" : "border-border"}
              >
                90d
              </Button>
              <Button
                variant={periodo === "ano" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodo("ano")}
                className={periodo === "ano" ? "bg-primary" : "border-border"}
              >
                1a
              </Button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={evolucaoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,20%)" />
              <XAxis dataKey="date" stroke="hsl(220,10%,55%)" fontSize={11} />
              <YAxis stroke="hsl(220,10%,55%)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "hsl(220,18%,13%)", border: "1px solid hsl(220,15%,20%)", borderRadius: 8 }}
                labelStyle={{ color: "hsl(220,10%,92%)" }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Area type="monotone" dataKey="receitas" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Receitas" />
              <Area type="monotone" dataKey="gastos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Gastos" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Vendas por Mediador */}
        <motion.div variants={item} className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Vendas por Mediador</h2>
          {vendasMediadorData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
              <Users className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">Nenhuma venda registrada</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={vendasMediadorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,20%)" />
                <XAxis dataKey="name" stroke="hsl(220,10%,55%)" fontSize={11} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="hsl(220,10%,55%)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,13%)", border: "1px solid hsl(220,15%,20%)", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(220,10%,92%)" }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Gráficos de Pizza */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div variants={item} className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Distribuição de Ganhos</h2>
          {pieGanhosData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground">
              <TrendingUp className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">Nenhum ganho registrado</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieGanhosData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pieGanhosData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,13%)", border: "1px solid hsl(220,15%,20%)", borderRadius: 8 }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div variants={item} className="glass-card p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Distribuição de Gastos</h2>
          {pieGastosData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground">
              <TrendingDown className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">Nenhum gasto registrado</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieGastosData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pieGastosData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,13%)", border: "1px solid hsl(220,15%,20%)", borderRadius: 8 }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Lista de Lançamentos */}
      <motion.div variants={item} className="glass-card overflow-hidden">
        <div className="p-4 sm:p-6 pb-3 border-b border-border/30">
          <h2 className="text-base sm:text-lg font-semibold">Histórico de Lançamentos</h2>
        </div>

        {loading && lancamentos.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-muted-foreground">Carregando...</span>
          </div>
        ) : lancamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <DollarSign className="h-8 w-8 opacity-20" />
            <p className="text-sm">Nenhum lançamento encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/20">
                  <th className="text-left p-4 text-muted-foreground font-medium">Data</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Categoria</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Descrição</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Valor</th>
                  <th className="text-center p-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {lancamentos.map((l) => (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-border/30 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="p-4 text-muted-foreground text-xs">
                        {formatDate(l.data_lancamento)}
                      </td>
                      <td className="p-4">
                        {l.tipo === "ganho" ? (
                          <Badge className="bg-success/20 text-success border-success/30">
                            Ganho
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                            Gasto
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 font-medium">{l.categoria}</td>
                      <td className="p-4 text-muted-foreground">
                        {l.descricao || "—"}
                      </td>
                      <td className={`p-4 text-right font-semibold ${l.tipo === "ganho" ? "text-success" : "text-destructive"}`}>
                        {l.tipo === "ganho" ? "+" : "-"} {formatCurrency(l.valor)}
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(l.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}