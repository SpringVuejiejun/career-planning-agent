import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { seedCareerData, listJobs, getJobGraph, type JobProfile, type JobRelation } from "@/lib/career-api"
import { Network, ArrowRightLeft, ArrowUpRight } from "lucide-react"

function groupByCategory(jobs: JobProfile[]) {
  const map = new Map<string, JobProfile[]>()
  for (const j of jobs) {
    const key = j.category || "其他"
    map.set(key, [...(map.get(key) || []), j])
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-CN"))
}

export function CareerJobs() {
  const [jobs, setJobs] = useState<JobProfile[]>([])
  const [relations, setRelations] = useState<JobRelation[]>([])
  const [loading, setLoading] = useState(false)
  const [relationType, setRelationType] = useState<"all" | "vertical" | "transition">("all")
  const [error, setError] = useState<string | null>(null)

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const grouped = useMemo(() => groupByCategory(jobs), [jobs])

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      await seedCareerData()
      const [jobRows, graph] = await Promise.all([
        listJobs(),
        getJobGraph(relationType === "all" ? undefined : relationType),
      ])
      setJobs(jobRows)
      setRelations(graph.relations)
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationType])

  return (
    <div className="flex h-full w-full min-h-0 flex-1 p-4">
      <Card className="flex h-full w-full min-w-0 flex-col border-border/80 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-lg">就业岗位画像与图谱</CardTitle>
          </div>
          <CardDescription>
            查看岗位画像（技能/证书/通用素质/实习能力等）与岗位关联图谱（垂直晋升/换岗路径）。
          </CardDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={relationType === "all" ? "default" : "secondary"} size="sm" onClick={() => setRelationType("all")}>
              全部关系
            </Button>
            <Button variant={relationType === "vertical" ? "default" : "secondary"} size="sm" onClick={() => setRelationType("vertical")}>
              <ArrowUpRight className="mr-1 size-4" /> 垂直晋升
            </Button>
            <Button variant={relationType === "transition" ? "default" : "secondary"} size="sm" onClick={() => setRelationType("transition")}>
              <ArrowRightLeft className="mr-1 size-4" /> 换岗路径
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              刷新
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 min-h-0 gap-4 overflow-hidden p-4">
          <div className="w-[45%] min-w-[320px] overflow-y-auto pr-2">
            {error && <div className="mb-3 text-sm text-destructive">{error}</div>}
            {grouped.map(([cat, rows]) => (
              <div key={cat} className="mb-4">
                <div className="mb-2 text-sm font-semibold text-foreground/80">{cat}</div>
                <div className="space-y-2">
                  {rows.map((j) => (
                    <div key={j.id} className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{j.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {j.level ? `级别：${j.level}` : "级别：-"} / {j.code}
                          </div>
                        </div>
                      </div>
                      {j.description && <div className="mt-2 text-sm text-foreground/80">{j.description}</div>}
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground/70">专业技能：</span>
                          {Array.isArray(j.skills) ? j.skills.join("、") : "-"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground/70">证书：</span>
                          {Array.isArray(j.certificates) ? j.certificates.join("、") : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto pl-2">
            <div className="mb-2 text-sm font-semibold text-foreground/80">岗位关系图谱（列表视图）</div>
            <div className="space-y-2">
              {relations.map((r) => {
                const from = jobById.get(r.from_job_id)
                const to = jobById.get(r.to_job_id)
                return (
                  <div key={r.id} className="rounded-lg border border-border/60 bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{from?.name || r.from_job_id}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{to?.name || r.to_job_id}</span>
                      <span className="ml-auto rounded bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {r.relation_type}
                      </span>
                    </div>
                    {(r.title || r.rationale) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {r.title ? <span className="font-medium text-foreground/70">{r.title}：</span> : null}
                        {r.rationale || ""}
                      </div>
                    )}
                  </div>
                )
              })}
              {relations.length === 0 && (
                <div className="text-sm text-muted-foreground">暂无关系数据（可点击“刷新”或检查后端 seed）。</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

