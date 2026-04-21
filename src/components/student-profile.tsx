import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  createStudentProfileManual,
  listStudentProfiles,
  uploadResume,
  type StudentProfile,
} from '@/lib/career-api';
import { UserRoundCheck, Upload } from 'lucide-react';

function scoreBadge(score?: number | null) {
  if (score == null) return '—';
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '待提升';
}

export function StudentProfilePage() {
  const [text, setText] = useState('');
  const [textHint, setTextHint] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = useMemo(() => profiles[0] || null, [profiles]);
  const latestSummary = useMemo(() => {
    if (!latest) return '';

    const edu =
      latest.education && typeof latest.education === 'object'
        ? latest.education
        : null;
    const degree = edu?.['学历'] || edu?.degree || '';
    const major = edu?.['专业'] || edu?.major || '';
    const grade = edu?.['年级'] || edu?.grade || '';
    const eduLine = [degree, major, grade].filter(Boolean).join(' / ');

    const skills = Array.isArray(latest.skills) ? latest.skills : [];
    const certs = Array.isArray(latest.certificates) ? latest.certificates : [];
    const projects = Array.isArray(latest.projects) ? latest.projects : [];
    const awards = Array.isArray(latest.awards) ? latest.awards : [];

    const comps =
      latest.competencies && typeof latest.competencies === 'object'
        ? latest.competencies
        : {};
    const compKeys = ['创新能力', '学习能力', '抗压能力', '沟通能力'];
    const compLines = compKeys
      .map((k) => {
        const v = (comps as any)[k];
        if (!v) return null;
        return `${k}：${String(v)}`;
      })
      .filter(Boolean) as string[];

    const internship =
      latest.internship && typeof latest.internship === 'object'
        ? latest.internship
        : null;
    const internshipSummary =
      internship?.['实习经历概述'] || internship?.summary || '';
    const internshipRole = internship?.['岗位'] || internship?.role || '';
    const internshipAchievement =
      internship?.['成果'] || internship?.achievement || '';
    const internshipDuration =
      internship?.['时长'] || internship?.duration || '';
    const internshipLine = [
      internshipSummary,
      internshipRole,
      internshipAchievement,
      internshipDuration,
    ]
      .filter(Boolean)
      .join('；');

    const scoring =
      latest.scoring_detail && typeof latest.scoring_detail === 'object'
        ? latest.scoring_detail
        : null;
    const scoringLines = scoring
      ? Object.entries(scoring)
          .slice(0, 6)
          .map(([k, v]) => `${k}：${String(v)}`)
      : [];

    const parts: string[] = [];
    parts.push(
      `总体评分：完整度 ${latest.completeness_score ?? '—'}（${scoreBadge(latest.completeness_score)}），竞争力 ${latest.competitiveness_score ?? '—'}（${scoreBadge(latest.competitiveness_score)}）。`
    );
    if (eduLine) parts.push(`教育背景：${eduLine}。`);
    parts.push(
      `专业技能：${skills.length ? skills.slice(0, 12).join('、') : '暂未明确（建议补充技能栈与熟练度）'}。`
    );
    parts.push(
      `证书情况：${certs.length ? certs.slice(0, 10).join('、') : '暂未提及（如有请补充）'}。`
    );
    parts.push(
      `项目经历：${projects.length ? `已记录 ${projects.length} 项（建议补充项目职责与成果）` : '暂未提及（建议补充 1-2 个代表项目）'}。`
    );
    parts.push(
      `实习经历：${internshipLine ? internshipLine : '暂未提及（建议补充岗位、周期与可量化成果）'}。`
    );
    if (compLines.length) parts.push(`通用素质亮点：${compLines.join('；')}。`);
    parts.push(
      `竞赛/奖项：${awards.length ? awards.slice(0, 10).join('、') : '暂未提及'}。`
    );
    if (scoringLines.length) {
      parts.push('');
      parts.push('评分依据（摘要）：');
      parts.push(...scoringLines.map((x) => `- ${x}`));
    }

    return parts.join('\n');
  }, [latest]);

  const refresh = async () => {
    setError(null);
    try {
      const rows = await listStudentProfiles();
      setProfiles(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createFromText = async () => {
    setLoading(true);
    setError(null);
    try {
      await createStudentProfileManual(text);
      setText('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const createFromResume = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await uploadResume(file, textHint);
      setFile(null);
      setTextHint('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex h-full w-full min-h-0 flex-1 p-4'>
      <Card className='flex h-full w-full min-w-0 flex-col border-border/80 bg-card/80 backdrop-blur-sm'>
        <CardHeader className='border-b border-border/60 pb-4 flex-shrink-0'>
          <div className='flex items-center gap-2'>
            <UserRoundCheck className='size-5 text-primary' aria-hidden />
            <CardTitle className='text-lg'>学生就业能力画像</CardTitle>
          </div>
          <CardDescription>
            通过“录入信息”或“简历上传（推荐
            txt）”生成能力画像，并给出完整度/竞争力评分。
          </CardDescription>
        </CardHeader>

        <CardContent className='flex flex-1 min-h-0 gap-4 overflow-hidden p-4'>
          <div className='w-[45%] min-w-[320px] overflow-y-auto pr-2 space-y-4'>
            {error && <div className='text-sm text-destructive'>{error}</div>}

            <div className='rounded-lg border border-border/60 bg-muted/40 p-3'>
              <div className='text-sm font-semibold'>方式一：自行录入</div>
              <div className='mt-2 text-xs text-muted-foreground'>
                建议包含：专业/年级、技能栈、证书、项目/实习、竞赛奖项、城市意向等。
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className='mt-2 min-h-[160px]'
                placeholder='粘贴或输入你的经历与能力信息(至少10字)...'
                disabled={loading}
              />
              <div className='mt-2 flex justify-end'>
                <Button
                  onClick={() => void createFromText()}
                  disabled={loading || text.trim().length < 10}
                >
                  生成画像
                </Button>
              </div>
            </div>

            <div className='rounded-lg border border-border/60 bg-muted/40 p-3'>
              <div className='flex items-center gap-2 text-sm font-semibold'>
                <Upload className='size-4' /> 方式二：简历上传
              </div>
              <div className='mt-2 text-xs text-muted-foreground'>
                支持 <span className='font-medium'>txt/pdf/docx</span>{' '}
                上传；若文件内容复杂导致解析不完整，可把简历文本粘贴到下方补充说明提高准确性。
              </div>
              <Input
                type='file'
                accept='.txt,.md,.text,.pdf,.docx'
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={loading}
                className='mt-2'
              />
              <Textarea
                value={textHint}
                onChange={(e) => setTextHint(e.target.value)}
                className='mt-2 min-h-[100px]'
                placeholder='（可选）补充说明：目标方向/城市/补充信息...'
                disabled={loading}
              />
              <div className='mt-2 flex justify-end'>
                <Button
                  onClick={() => void createFromResume()}
                  disabled={loading || !file}
                >
                  上传并生成
                </Button>
              </div>
            </div>
          </div>

          <div className='flex-1 min-w-0 overflow-y-auto pl-2'>
            <div className='mb-2 text-sm font-semibold text-foreground/80'>
              历史画像
            </div>
            <div className='space-y-2'>
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className='rounded-lg border border-border/60 bg-muted/40 p-3'
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <div className='font-medium'>画像 {p.id}</div>
                    <div className='text-xs text-muted-foreground'>
                      来源：{p.source_type}
                      {p.source_filename ? `（${p.source_filename}）` : ''}
                    </div>
                    <div className='ml-auto flex gap-2 text-xs'>
                      <span className='rounded bg-background px-2 py-0.5 text-muted-foreground'>
                        完整度：{p.completeness_score ?? '—'}（
                        {scoreBadge(p.completeness_score)}）
                      </span>
                      <span className='rounded bg-background px-2 py-0.5 text-muted-foreground'>
                        竞争力：{p.competitiveness_score ?? '—'}（
                        {scoreBadge(p.competitiveness_score)}）
                      </span>
                    </div>
                  </div>
                  <div className='mt-2 text-xs text-muted-foreground'>
                    <span className='font-medium text-foreground/70'>
                      技能：
                    </span>
                    {Array.isArray(p.skills)
                      ? p.skills.slice(0, 12).join('、')
                      : '—'}
                  </div>
                  <div className='mt-1 text-xs text-muted-foreground'>
                    <span className='font-medium text-foreground/70'>
                      证书：
                    </span>
                    {Array.isArray(p.certificates)
                      ? p.certificates.slice(0, 8).join('、')
                      : '无'}
                  </div>
                </div>
              ))}
              {profiles.length === 0 && (
                <div className='text-sm text-muted-foreground'>
                  暂无画像，请先在左侧生成一份。
                </div>
              )}
            </div>

            {latest && (
              <div className='mt-4 rounded-lg border border-border/60 bg-muted/40 p-3'>
                <div className='text-sm font-semibold'>
                  最新画像详情（摘要）
                </div>
                <div className='mt-2 max-h-[320px] overflow-auto rounded bg-background p-3 text-xs text-foreground/80 whitespace-pre-wrap'>
                  {latestSummary}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
