"use client";
export default function BankTabs({ bank, setBank }: { bank: "A"|"B"|"C"; setBank: (b:"A"|"B"|"C")=>void }) {
  const Tab = ({ id }: { id: "A"|"B"|"C" }) => (
    <button
      onClick={()=>setBank(id)}
      className={`px-3 py-1.5 rounded-lg ${bank===id ? "bg-indigo-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/15"}`}
    >Bank {id}</button>
  );
  return <div className="flex gap-2">{["A","B","C"].map(x => <Tab key={x as any} id={x as any} />)}</div>;
}