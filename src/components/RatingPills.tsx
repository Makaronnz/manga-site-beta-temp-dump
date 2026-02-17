"use client";
const ALL = ["safe", "suggestive", "erotica"] as const; // pornographic dahil etmiyoruz.
export type Rating = typeof ALL[number];


export default function RatingPills({
values,
onChange,
}: {
values: Rating[];
onChange: (next: Rating[]) => void;
}) {
function toggle(v: Rating) {
const set = new Set(values);
if (set.has(v)) set.delete(v); else set.add(v);
const arr = Array.from(set) as Rating[];
onChange(arr.length ? arr : ["safe"]);
}


return (
<div className="flex flex-wrap gap-2">
{ALL.map((r) => (
<button
key={r}
onClick={() => toggle(r)}
className={`px-3 py-1 rounded-full text-xs border transition ${
values.includes(r)
? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
: "border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40"
}`}
aria-pressed={values.includes(r)}
>
{r}
</button>
))}
</div>
);
}