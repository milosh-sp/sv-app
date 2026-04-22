import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  BriefcaseIcon,
  CheckCircleIcon,
  ClockIcon,
  CertificateIcon,
  CodeIcon,
  FolderSimpleIcon,
  GraduationCapIcon,
  SmileyWinkIcon,
  type Icon,
  XCircleIcon,
  UserFocusIcon,
} from "@phosphor-icons/react";

type SectionGroupProps = {
  icon: Icon;
  title: string;
  children: React.ReactNode;
};

function SectionGroup({ icon: IconComponent, title, children }: SectionGroupProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 border-b pb-2 text-lg font-semibold tracking-tight text-foreground">
        <IconComponent aria-hidden="true" size={18} weight="regular" className="text-muted-foreground" />
        <span className="text-balance">{title}</span>
      </div>
      {children}
    </section>
  );
}

type StatusType = "approved" | "pending" | "rejected";

function StatusMark({ status }: { status: StatusType }) {
  if (status === "approved") {
    return <CheckCircleIcon aria-hidden="true" size={22} weight="duotone" className="text-primary" />;
  }

  if (status === "pending") {
    return <ClockIcon aria-hidden="true" size={22} weight="duotone" className="text-muted-foreground" />;
  }

  return <XCircleIcon aria-hidden="true" size={22} weight="duotone" className="text-muted-foreground" />;
}

function SideBracket() {
  return (
    <span aria-hidden="true" className="inline-block h-8 w-2 rounded-l-full border-s-2 border-muted-foreground/70" />
  );
}

type ResumeRowProps = {
  title: string;
  subtitle?: string;
  status?: StatusType;
};

function ResumeRow({ title, subtitle, status }: ResumeRowProps) {
  return (
    <div className="flex items-start gap-2">
      <SideBracket />
      <div className="min-w-0 flex-1">
        <p className="text-[0.96rem] leading-snug font-medium tracking-tight text-foreground">{title}</p>
        {subtitle && <p className="text-sm leading-snug text-muted-foreground">{subtitle}</p>}
      </div>
      {status && (
        <div className="pt-0.5">
          <StatusMark status={status} />
        </div>
      )}
    </div>
  );
}

export function HeroVisual() {
  return (
    <div
      aria-label={t`Preview of a verified candidate profile`}
      role="img"
      className="pointer-events-none relative size-full overflow-hidden rounded-2xl border bg-card"
    >
      <div className="relative flex h-full flex-col">
        <header className="flex items-center gap-3 border-b bg-primary/10 px-6 py-4 md:px-8">
          <div
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary"
          >
            <UserFocusIcon size={24} weight="regular" />
          </div>
          <div className="min-w-0">
            <p className="text-3xl leading-tight font-semibold tracking-tight text-foreground">
              <Trans>Alex Smith</Trans>
            </p>
            <p className="text-base text-muted-foreground">
              <Trans>Senior Full Stack Developer</Trans>
            </p>
          </div>
        </header>

        <div className="grid flex-1 gap-6 p-6 md:grid-cols-2 md:gap-8 md:p-8">
          <div className="space-y-6">
            <SectionGroup icon={CodeIcon} title={t`Technical skills`}>
              <div className="grid gap-2 sm:grid-cols-2">
                <ResumeRow title={t`Docker`} status="rejected" />
                <ResumeRow title={t`JavaScript`} status="pending" />
                <ResumeRow title={t`Node.js`} status="pending" />
                <ResumeRow title={t`React`} status="approved" />
                <ResumeRow title={t`AWS`} status="approved" />
                <ResumeRow title={t`AI / ML`} status="approved" />
              </div>
            </SectionGroup>

            <SectionGroup icon={GraduationCapIcon} title={t`Education`}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[1.1rem] leading-tight font-medium tracking-tight text-foreground">
                      <Trans>MSc Computer Science</Trans>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <Trans>2014 - 2016</Trans>
                    </p>
                  </div>
                  <p className="text-base text-muted-foreground">
                    <Trans>Harvard University</Trans>
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[1.1rem] leading-tight font-medium tracking-tight text-foreground">
                      <Trans>BSc Software Engineering</Trans>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <Trans>2010 - 2014</Trans>
                    </p>
                  </div>
                  <p className="text-base text-muted-foreground">
                    <Trans>Oxford University</Trans>
                  </p>
                </div>
              </div>
            </SectionGroup>

            <SectionGroup icon={BriefcaseIcon} title={t`Experience`}>
              <div className="space-y-1 opacity-45">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[1.05rem] leading-tight font-medium tracking-tight text-foreground">
                    <Trans>Senior AI Engineer</Trans>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <Trans>2020 - Present</Trans>
                  </p>
                </div>
                <p className="text-base text-muted-foreground">
                  <Trans>OpenAI</Trans>
                </p>
              </div>
            </SectionGroup>
          </div>

          <div className="space-y-6">
            <SectionGroup icon={FolderSimpleIcon} title={t`Projects`}>
              <div className="space-y-3">
                <ResumeRow
                  title={t`E-commerce Platform`}
                  subtitle={t`Full-stack React/Node.js application with payment integration`}
                  status="approved"
                />
                <ResumeRow
                  title={t`Task Management App`}
                  subtitle={t`React Native mobile app with real-time synchronization`}
                  status="rejected"
                />
                <ResumeRow
                  title={t`Data Analytics Dashboard`}
                  subtitle={t`Python/Django dashboard with interactive visualizations`}
                  status="approved"
                />
              </div>
            </SectionGroup>

            <SectionGroup icon={SmileyWinkIcon} title={t`Personality`}>
              <div className="grid grid-cols-2 gap-2">
                <ResumeRow title={t`Action oriented`} />
                <ResumeRow title={t`Self-starter`} />
                <ResumeRow title={t`Analytical`} />
                <ResumeRow title={t`Team player`} />
              </div>
            </SectionGroup>

            <SectionGroup icon={CertificateIcon} title={t`Certifications`}>
              <div className="space-y-2 opacity-45">
                <ResumeRow title={t`AWS Certified Solutions Architect`} status="approved" />
                <ResumeRow title={t`Google Professional Cloud Architect`} status="approved" />
              </div>
            </SectionGroup>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-primary/10 to-transparent"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background/70"
        />
      </div>
    </div>
  );
}
