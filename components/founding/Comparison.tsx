import { Check, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FadeUp } from "@/components/FadeUp";

type Cell = true | false | string;

const rows: { feature: string; free: Cell; founding: Cell }[] = [
  { feature: "Bookmarks", free: "Unlimited", founding: "Unlimited" },
  { feature: "AI summaries", free: "Unlimited", founding: "Unlimited" },
  { feature: "Weekly digest", free: true, founding: true },
  { feature: "Smart search", free: true, founding: true },
  { feature: "Rudolf usage", free: "30 biscuits / month", founding: "Unlimited" },
  { feature: "Collections", free: "Basic", founding: "Unlimited" },
  { feature: "New features", free: "Standard rollout", founding: "Early access" },
  { feature: "Product roadmap", free: false, founding: true },
  { feature: "Founder community", free: false, founding: true },
  { feature: "Founder badge", free: false, founding: true },
  { feature: "Lifetime membership", free: false, founding: true },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="size-5 text-foreground" />;
  if (value === false) return <Minus className="size-5 text-muted-foreground" />;
  return <span className="text-foreground">{value}</span>;
}

export function FoundingComparison() {
  return (
    <section
      id="comparison"
      className="border-t border-border py-[120px] md:py-[160px]"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <h2 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-foreground md:text-6xl">
            Compare plans.
          </h2>
        </FadeUp>

        <FadeUp delay={0.08} className="mt-16">
          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-center">Free</TableHead>
                  <TableHead className="text-center">
                    Founding Member
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.feature}>
                    <TableCell className="font-medium text-foreground whitespace-normal">
                      {row.feature}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <CellValue value={row.free} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <CellValue value={row.founding} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
