/**
 * Firebreak — Autonomous Incident Remediation & Ephemeral Patch Verification
 * Core Application Engine & Interactive Controller
 *
 * Architecture Modules:
 * 1. Architecture Topology Visualizer (SVG Node & Packet Routing Graph)
 * 2. Incident Lifecycle Simulation Engine (10-Stage Deterministic Workflow)
 * 3. Real-Time Telemetry & Metrics Canvas Engine (PromQL Timeseries Render)
 * 4. Google ADK Multi-Agent Cluster Reasoning Studio
 * 5. Interactive SRE Integration Gateways (Slack Signals & GitHub PRs)
 * 6. Node Specification Modal & Inspector Drawer
 * 7. Filterable Enterprise Technology Directory
 */

'use strict';

/* ==========================================================================
   1. SPECIFICATION DATA & KNOWLEDGE MODELS
   ========================================================================== */

/**
 * Formal Architecture Nodes based on the Firebreak Project Specification.
 * Each node contains full enterprise metadata for the inspector modal.
 */
const ARCHITECTURE_NODES = {
  chaos: {
    id: 'chaos',
    name: 'Chaos Lab',
    category: 'Testing & Validation',
    subtitle: 'Fault Injection',
    x: 30,
    y: 40,
    color: '#FF3B5C',
    monogram: 'CL',
    purpose: 'Injects deterministic, labeled real-world failure modes (memory leaks, N+1 ORM queries, threadpool exhaustion, bad configuration drifts) into microservices.',
    inputSchema: 'Chaos Injection Toggles, Traffic Multipliers, Fault Schedules',
    outputSchema: 'Failing HTTP/gRPC traffic, degradation metrics, runtime stack traces, ground-truth labels',
    resiliency: 'Runs in isolated network namespaces; automatic fault teardown after configured test duration.',
    techStack: 'Express.js, FastAPI, Go 1.22, Docker Engine',
    advantages: 'Establishes empirical ground truth for scoring detection precision, recall, and root-cause accuracy.'
  },
  prom: {
    id: 'prom',
    name: 'Prometheus',
    category: 'Observability & eBPF',
    subtitle: 'Metrics & Kepler eBPF',
    x: 275,
    y: 40,
    color: '#E6522C',
    monogram: 'Pm',
    purpose: 'Scrapes time-series metrics from microservices and captures per-container energy consumption (joules and watts) via Kepler eBPF probes.',
    inputSchema: 'HTTP /metrics scrape targets (cadvisor, node_exporter, application runtime)',
    outputSchema: 'PromQL time-series vectors, rate-of-change derivatives, seasonal baselines',
    resiliency: 'High-availability scrape clusters with local WAL persistence and retention policies.',
    techStack: 'Prometheus Server, CNCF Kepler (eBPF), PromQL Engine',
    advantages: 'Enables instant mathematical statistical anomaly detection (Z-score and EWMA) without expensive LLM token usage.'
  },
  loki: {
    id: 'loki',
    name: 'Grafana Loki',
    category: 'Telemetry Collection',
    subtitle: 'Alloy Log Pipeline',
    x: 515,
    y: 40,
    color: '#F5A623',
    monogram: 'Lk',
    purpose: 'Aggregates, indexes, and streams structured application and system logs via Grafana Alloy unified telemetry pipeline.',
    inputSchema: 'Standard output streams, container log drivers, systemd journals',
    outputSchema: 'LogQL query streams, error cluster signatures, high-frequency stack traces',
    resiliency: 'Stateless collector nodes with backpressure buffering and object storage durability.',
    techStack: 'Grafana Loki, Grafana Alloy Collector, LogQL Stream Parser',
    advantages: 'Label-indexed indexing keeps ingestion cost minimal while providing instantaneous pattern clustering for reasoning agents.'
  },
  temporal: {
    id: 'temporal',
    name: 'Temporal Server',
    category: 'Workflow Orchestration',
    subtitle: 'Durable Workflows',
    x: 755,
    y: 40,
    color: '#7C5CFC',
    monogram: 'Tp',
    purpose: 'Guarantees durable execution of incident monitoring schedules, multi-agent triage workflows, sandbox verification, and human approval signals.',
    inputSchema: 'Cron tick schedules (30-60s), telemetry threshold triggers, human interactive signals',
    outputSchema: 'Durable event history, replayable execution states, deterministic activity dispatches',
    resiliency: 'Zero state loss across process crashes; activities retry with exponential backoff; human signal gates wait indefinitely without CPU consumption.',
    techStack: 'Temporal Python SDK, Temporal Server, PostgreSQL persistence backend',
    advantages: 'Eliminates brittle cron scripts and prevents zombie incidents through deterministic orchestration and continue-as-new history rollups.'
  },
  adk: {
    id: 'adk',
    name: 'Google ADK',
    category: 'Reasoning & Intelligence',
    subtitle: '6 Parallel Agents',
    x: 995,
    y: 40,
    color: '#4285F4',
    monogram: 'AD',
    purpose: 'Executes parallel and sequential AI investigations through 6 read-only, schema-constrained reasoning agents with strict Pydantic v2 validation.',
    inputSchema: 'Statistical anomaly alerts, PromQL/LogQL query windows, git commit diffs, memory recalls',
    outputSchema: 'Pydantic-validated Finding schemas, RankedHypotheses, and FixProposal diff payloads',
    resiliency: 'Read-only tool guards prevent unauthorized mutations; schema failures prompt immediate structured re-prompting.',
    techStack: 'Google Agent Development Kit (ADK), Gemini 1.5 Pro / Flash, Pydantic v2',
    advantages: 'Parallel multi-agent decomposition prevents hallucination and cites verifiable metric queries for every finding.'
  },
  api: {
    id: 'api',
    name: 'FastAPI Gateway',
    category: 'System Core',
    subtitle: 'PostgreSQL & REST',
    x: 515,
    y: 195,
    color: '#009688',
    monogram: 'Fa',
    purpose: 'Translates external webhooks, dashboard actions, and Slack interactions into strongly typed Temporal Signals and provides query endpoints.',
    inputSchema: 'REST API requests, Slack interactivity payloads, GitHub Webhooks',
    outputSchema: 'Validated Temporal client signal dispatches, JSON incident audit streams',
    resiliency: 'Stateless API workers fronted by connection-pooled PostgreSQL with ACID compliance.',
    techStack: 'FastAPI, Pydantic v2, PostgreSQL, SQLAlchemy Async Engine',
    advantages: 'Provides a secure, audited gateway between asynchronous workflow execution and interactive developer interfaces.'
  },
  gem: {
    id: 'gem',
    name: 'JarvisLabs GPU',
    category: 'Accelerated Compute',
    subtitle: 'NVIDIA H100 LLM',
    x: 995,
    y: 195,
    color: '#76B900',
    monogram: 'JL',
    purpose: 'Dedicated high-throughput GPU infrastructure hosting open models and routing inference through LiteLLM gateways for near-instant agent reasoning.',
    inputSchema: 'Agent system prompts, structured context windows, few-shot prompt templates',
    outputSchema: 'Low-latency JSON completions, token generation streams (140+ tokens/sec)',
    resiliency: 'Automated fallback to Gemini cloud endpoints via LiteLLM if local GPU quotas saturate.',
    techStack: 'JarvisLabs Dedicated Compute, NVIDIA H100 80GB, LiteLLM Proxy',
    advantages: 'Delivers sub-second reasoning speeds while safeguarding code sovereignty and private repository telemetry.'
  },
  dev: {
    id: 'dev',
    name: 'Human SRE Gate',
    category: 'Governance & Gatekeeper',
    subtitle: 'Approve · Reject · Edit',
    x: 30,
    y: 350,
    color: '#FBBF24',
    monogram: 'Dv',
    purpose: 'Empowers the on-call engineer with complete veto and approval authority over every suggested code remediation via Slack buttons, GitHub, or web console.',
    inputSchema: 'Slack interactive signals, GitHub PR review status, Dashboard click events',
    outputSchema: 'approve_fix, reject_fix, or edit_fix Temporal Signals with reviewer identity',
    resiliency: 'Workflows wait safely in pause state; timeouts automatically escalate to senior on-call if unaddressed.',
    techStack: 'FastAPI Signal Dispatcher, Temporal Signal Handlers',
    advantages: 'Guarantees 100% human oversight: eliminates risky autonomous production changes while removing 90% of manual debugging toil.'
  },
  slack: {
    id: 'slack',
    name: 'Slack & PagerDuty',
    category: 'Alerting & Delivery',
    subtitle: 'Interactive Alerts',
    x: 275,
    y: 350,
    color: '#E01E5A',
    monogram: 'Sl',
    purpose: 'Dispatches two coordinated reports per incident (Initial Report within 2 minutes; Final Resolution Report upon baseline recovery) with interactive action buttons.',
    inputSchema: 'SEV1/SEV2 incident notifications, candidate diff summaries, Temporal signal webhooks',
    outputSchema: 'Interactive threaded message updates, SRE interactive button actions',
    resiliency: 'Message thread deduplication by incident fingerprint; escalates SEV1 to PagerDuty with retry policies.',
    techStack: 'Slack Block Kit API, Slack SDK, PagerDuty Incident Webhooks',
    advantages: 'Keeps on-call teams informed in their existing collaboration hub without requiring manual dashboard context gathering.'
  },
  github: {
    id: 'github',
    name: 'GitHub Gateway',
    category: 'Code Governance',
    subtitle: 'Draft Pull Requests',
    x: 515,
    y: 350,
    color: '#8B949E',
    monogram: 'Gh',
    purpose: 'Opens clean, annotated Draft Pull Requests on the customer repository containing the verified patch diff, sandbox execution proofs, and post-mortem notes.',
    inputSchema: 'Verified candidate diff, branch metadata, test execution benchmark report',
    outputSchema: 'GitHub Draft PR link, commit check annotations, webhook event stream',
    resiliency: 'Strict branch permission boundaries: never performs autonomous merges; adheres to CODEOWNERS rules.',
    techStack: 'GitHub App API, Git CLI, Octokit SDK',
    advantages: 'Allows SREs and software engineers to review AI-generated remediations inside their standard peer-review developer workflows.'
  },
  docker: {
    id: 'docker',
    name: 'Docker Sandbox',
    category: 'Execution Sandbox',
    subtitle: 'Patch Verification',
    x: 755,
    y: 350,
    color: '#2496ED',
    monogram: 'Dk',
    purpose: 'Builds candidate patch containers inside isolated, read-only throwaway environments and replays failing load traffic to mathematically prove the fix.',
    inputSchema: 'Candidate git diff, target service base image, chaos lab replay fixtures',
    outputSchema: 'Deterministic test matrix verdict: PASS / FAIL / INCONCLUSIVE, p99 delta, cgroup memory diff',
    resiliency: 'Strict cgroup limits (CPU/Memory), execution timeout boundaries, guaranteed container cleanup on exit.',
    techStack: 'Docker Engine SDK, Linux cgroups v2, Ephemeral Volume Mounts',
    advantages: 'Eliminates speculative AI hallucination: no code is ever recommended unless it passes real unit and load tests.'
  },
  mem: {
    id: 'mem',
    name: 'Supermemory',
    category: 'Institutional Memory',
    subtitle: 'Vector Store',
    x: 995,
    y: 350,
    color: '#14B8A6',
    monogram: 'Sm',
    purpose: 'Stores vector representations of historical incidents, rejected fixes, successful resolutions, and known harmless alert noise signatures.',
    inputSchema: 'Post-mortem summaries, approved patch diffs, engineer rejection feedback',
    outputSchema: 'Top-K semantic matches, historical fix templates, recurrence alerts',
    resiliency: 'Durable vector indexing with automated metadata tagging and reciprocal rank fusion.',
    techStack: 'Supermemory SDK, Hybrid Dense/Sparse Embeddings',
    advantages: 'Ensures the platform compounds in intelligence: repeat failures are resolved in seconds based on validated organizational precedent.'
  }
};

/**
 * Directed edges defining telemetry and control flow across the topology.
 */
const ARCHITECTURE_EDGES = [
  { from: 'chaos', to: 'prom' },
  { from: 'prom', to: 'loki' },
  { from: 'loki', to: 'temporal' },
  { from: 'temporal', to: 'adk' },
  { from: 'adk', to: 'gem' },
  { from: 'adk', to: 'mem' },
  { from: 'adk', to: 'temporal' },
  { from: 'temporal', to: 'docker' },
  { from: 'docker', to: 'github' },
  { from: 'github', to: 'api' },
  { from: 'temporal', to: 'slack' },
  { from: 'slack', to: 'dev' },
  { from: 'dev', to: 'api' },
  { from: 'api', to: 'temporal' },
  { from: 'temporal', to: 'mem' }
];

/**
 * 10 Deterministic Simulation Stages tracking an end-to-end incident lifecycle.
 */
const SIMULATION_STAGES = [
  {
    step: 1,
    shortLabel: 'Fault Injected',
    title: 'Synthetic Fault Injected in Production Service',
    description: 'Chaos Lab initiates a controlled memory leak and N+1 query loop on checkout-service (commit a1f3). Heap RSS climbs rapidly.',
    activeNodes: ['chaos', 'prom'],
    edge: { from: 'chaos', to: 'prom' },
    log: { level: 'error', text: 'chaos_lab: memory_rss_bytes exceeding threshold (+2.4GB) on checkout-pod-8b4f' },
    metrics: { p99: 0.95, rss: 1.8, dbQueries: 14 },
    status: 'anomaly',
    slack: {
      visible: true,
      alertClass: 'active-alert',
      message: '⚠️ <b>[CHAOS LAB]</b> Synthetic load anomaly injected on checkout-service. Scrapes active.'
    },
    pr: { visible: false }
  },
  {
    step: 2,
    shortLabel: 'Zero-LLM Gate',
    title: 'Statistical Anomaly Detected Without LLM',
    description: 'Scheduled Monitor Workflow executes EWMA & Z-Score evaluation over Prometheus scrapes. Z-Score breaches 4.8σ; anomaly confirmed.',
    activeNodes: ['prom', 'loki'],
    edge: { from: 'prom', to: 'loki' },
    log: { level: 'warn', text: 'temporal_monitor: z-score=4.82 > 3.0 threshold. Zero-LLM gatekeeper triggered.' },
    metrics: { p99: 2.15, rss: 2.6, dbQueries: 48 },
    status: 'anomaly',
    slack: {
      visible: true,
      alertClass: 'active-alert',
      message: '🚨 <b>INCIDENT DETECTED</b> — checkout-service latency p99 > 2.1s (normal 0.3s). Z-Score 4.8σ.'
    },
    pr: { visible: false }
  },
  {
    step: 3,
    shortLabel: 'Temporal Start',
    title: 'Temporal Incident Workflow Initialized',
    description: 'Durable IncidentWorkflow starts with fingerprint deduplication. Temporal schedules parallel investigation activities.',
    activeNodes: ['loki', 'temporal'],
    edge: { from: 'loki', to: 'temporal' },
    log: { level: 'temporal', text: 'temporal_core: started IncidentWorkflow(id=inc-checkout-9f2a, dedup_window=10m)' },
    metrics: { p99: 2.30, rss: 3.1, dbQueries: 48 },
    status: 'processing',
    slack: {
      visible: true,
      alertClass: 'active-alert',
      message: '📌 <b>Temporal Workflow Active:</b> <code>inc-checkout-9f2a</code>. Triage & Investigation dispatched.'
    },
    pr: { visible: false }
  },
  {
    step: 4,
    shortLabel: 'Slack Report',
    title: 'Initial Incident Report Dispatched to Slack',
    description: 'Under 90 seconds from onset: Slack #oncall receives initial triage report with severity classification (SEV2) and affected service.',
    activeNodes: ['temporal', 'slack'],
    edge: { from: 'temporal', to: 'slack' },
    log: { level: 'info', text: 'slack_gateway: dispatched initial incident card to #oncall-checkout (SEV2, conf=0.86)' },
    metrics: { p99: 2.35, rss: 3.4, dbQueries: 48 },
    status: 'processing',
    slack: {
      visible: true,
      alertClass: 'active-alert',
      message: '🚨 <b>SEV2 Incident Initial Report</b> | checkout-service | Latency: 2.35s | Suspected unevicted cache'
    },
    pr: { visible: false }
  },
  {
    step: 5,
    shortLabel: 'ADK Agents',
    title: 'Google ADK Multi-Agent Cluster Investigation',
    description: 'Metrics Agent, Logs Agent, and Changes Agent run in parallel. Commit a1f3 "optimize order retrieval" is identified as culprit.',
    activeNodes: ['temporal', 'adk'],
    edge: { from: 'temporal', to: 'adk' },
    log: { level: 'info', text: 'adk_cluster: metrics_agent (corr=0.94), changes_agent (commit a1f3 touched orders.ts)' },
    metrics: { p99: 2.40, rss: 3.7, dbQueries: 48 },
    status: 'processing',
    slack: {
      visible: true,
      alertClass: 'active-alert',
      message: '🔍 <b>Investigation:</b> Root Cause pinpointed: unbounded in-memory cache in <code>orders.ts</code>'
    },
    pr: { visible: false }
  },
  {
    step: 6,
    shortLabel: 'GPU Synthesis',
    title: 'Supermemory Recall & JarvisLabs GPU Inference',
    description: 'Supermemory retrieves past resolution from incident #142. JarvisLabs H100 GPU generates minimal LRU cache bounded fix proposal.',
    activeNodes: ['adk', 'gem', 'mem'],
    edge: { from: 'adk', to: 'gem' },
    log: { level: 'info', text: 'jarvis_gpu: prompt tokens=1840, completion tokens=312 in 280ms. Diff synthesized.' },
    metrics: { p99: 2.38, rss: 3.9, dbQueries: 48 },
    status: 'processing',
    slack: {
      visible: true,
      alertClass: 'active-alert',
      message: '💡 <b>Fix Proposal Synthesized:</b> Bound cache with LRU eviction policy (max_size=10,000).'
    },
    pr: { visible: false }
  },
  {
    step: 7,
    shortLabel: 'Docker Sandbox',
    title: 'Docker Sandbox Ephemeral Patch Verification',
    description: 'Docker container spins up with proposed patch. Failing traffic replayed. All 42 unit and performance load tests pass. Verdict: PASS.',
    activeNodes: ['temporal', 'docker'],
    edge: { from: 'temporal', to: 'docker' },
    log: { level: 'verified', text: 'docker_sandbox: build firebreak-sandbox/9f2a. Tests 42/42 passed. Memory stable.' },
    metrics: { p99: 0.38, rss: 0.85, dbQueries: 2 },
    status: 'resolved',
    slack: {
      visible: true,
      alertClass: 'active-verified',
      message: '✅ <b>Sandbox Verification PASS:</b> 42/42 tests pass. Latency reduced from 2.38s to 0.38s.'
    },
    pr: {
      visible: true,
      verified: true,
      diff: '- private cache = new Map<string, Order>();\n+ private cache = new QuickLRU<string, Order>({ maxSize: 10000 });'
    }
  },
  {
    step: 8,
    shortLabel: 'Draft PR Open',
    title: 'Automated Draft Pull Request Opened on GitHub',
    description: 'Draft PR #214 generated with verified code diff, sandbox benchmark logs, and Post-Mortem checklist. Never auto-merges.',
    activeNodes: ['docker', 'github'],
    edge: { from: 'docker', to: 'github' },
    log: { level: 'info', text: 'github_app: created draft pull request #214 (branch: firebreak/fix-checkout-cache)' },
    metrics: { p99: 0.35, rss: 0.82, dbQueries: 2 },
    status: 'waiting',
    slack: {
      visible: true,
      alertClass: 'active-verified',
      message: '📦 <b>Draft PR #214 Opened:</b> Waiting for on-call engineer review and approval signal.'
    },
    pr: {
      visible: true,
      verified: true,
      diff: '- private cache = new Map<string, Order>();\n+ private cache = new QuickLRU<string, Order>({ maxSize: 10000 });'
    }
  },
  {
    step: 9,
    shortLabel: 'SRE Approval',
    title: 'Human-in-the-Loop SRE Approves Remediation',
    description: 'On-call SRE reviews the diff and test proof in Slack, clicking "Approve Fix". Temporal receives durable signal approve_fix().',
    activeNodes: ['dev', 'api', 'temporal'],
    edge: { from: 'dev', to: 'api' },
    log: { level: 'temporal', text: 'temporal_signal: received approve_fix(user="maya.sre@company.com") via API gateway' },
    metrics: { p99: 0.32, rss: 0.78, dbQueries: 1 },
    status: 'resolved',
    slack: {
      visible: true,
      alertClass: 'active-verified',
      message: '👤 <b>Approved by Maya (SRE):</b> Fix merged & deployment triggered. Monitoring recovery.'
    },
    pr: {
      visible: true,
      verified: true,
      diff: '- private cache = new Map<string, Order>();\n+ private cache = new QuickLRU<string, Order>({ maxSize: 10000 });'
    }
  },
  {
    step: 10,
    shortLabel: 'Memory Learned',
    title: 'Baseline Recovery Verified & Knowledge Learned',
    description: 'Metrics hold at healthy baseline for 10 consecutive minutes. Resolution & approved diff written to Supermemory vector store.',
    activeNodes: ['temporal', 'mem', 'slack'],
    edge: { from: 'temporal', to: 'mem' },
    log: { level: 'verified', text: 'supermemory: saved incident resolution inc-checkout-9f2a. Total MTTR: 11m 40s.' },
    metrics: { p99: 0.28, rss: 0.75, dbQueries: 1 },
    status: 'resolved',
    slack: {
      visible: true,
      alertClass: 'active-verified',
      message: '🎉 <b>INCIDENT RESOLVED:</b> System verified healthy. Post-mortem committed to memory.'
    },
    pr: {
      visible: true,
      verified: true,
      diff: '- private cache = new Map<string, Order>();\n+ private cache = new QuickLRU<string, Order>({ maxSize: 10000 });'
    }
  }
];

/**
 * 6 Google ADK Specialized Agents.
 */
const ADK_AGENTS = [
  {
    name: 'Triage Agent',
    schema: 'TriageVerdict',
    role: 'Evaluates statistical anomalies, calculates confidence intervals, filters benign alert noise, and assigns incident severity (SEV1/SEV2).',
    tools: ['promql_query', 'get_noise_profile', 'search_supermemory'],
    thoughts: [
      'Evaluating Z-Score (4.82σ) against baseline seasonal window…',
      'Checking Supermemory for false-positive noise signatures…',
      'Confidence score: 0.88. Assigning classification: SEV2 Incident.'
    ]
  },
  {
    name: 'Metrics Agent',
    schema: 'MetricsFinding',
    role: 'Executes parametric PromQL queries to isolate anomalous timeseries, memory leaks, and CPU spikes across pods and microservices.',
    tools: ['promql_range', 'get_service_baseline', 'calculate_derivative'],
    thoughts: [
      'Querying rate(http_requests_total[2m]) across checkout pods…',
      'Correlating heap_allocated_bytes with request volume…',
      'Confirmed continuous positive memory slope since 14:02:10 UTC.'
    ]
  },
  {
    name: 'Logs Agent',
    schema: 'LogPatternFinding',
    role: 'Analyzes high-volume Grafana Loki log streams, clusters novel stack traces, and isolates uncaught exception signatures.',
    tools: ['logql_query', 'cluster_log_patterns', 'extract_stack_trace'],
    thoughts: [
      'Aggregating error log lines across namespace: production…',
      'Clustering 4,200 log messages into distinct semantic templates…',
      'Discovered new pattern: "OutOfMemoryError: Java heap space" at 14:03 UTC.'
    ]
  },
  {
    name: 'Changes Agent',
    schema: 'DeploymentCorrelation',
    role: 'Inspects recent GitHub deployments, merged pull requests, and commit diffs to correlate code modifications with incident onset.',
    tools: ['list_recent_deploys', 'get_commit_diff', 'inspect_ast'],
    thoughts: [
      'Scanning deployments in the preceding 60-minute window…',
      'Found commit a1f3 "refactor order cache" deployed 3m prior to spike.',
      'Identified unbounded Map initialization in orders.ts:line 42.'
    ]
  },
  {
    name: 'Fix Verification Agent',
    schema: 'FixProposal',
    role: 'Synthesizes minimal patch diffs based on AST analysis and past resolutions, and defines Docker container verification fixtures.',
    tools: ['synthesize_diff', 'generate_test_fixture', 'run_sandbox_matrix'],
    thoughts: [
      'Synthesizing minimal remediation: wrap Map with LRU eviction…',
      'Formulating test harness with 5,000 synthetic order requests…',
      'Dispatched build to Docker sandbox: awaiting execution verdict.'
    ]
  },
  {
    name: 'Post-Mortem Report Agent',
    schema: 'PostMortemReport',
    role: 'Assembles comprehensive, audit-ready post-incident documentation citing exact PromQL queries, git commit diffs, and MTTR benchmarks.',
    tools: ['assemble_timeline', 'format_markdown_report', 'commit_supermemory'],
    thoughts: [
      'Compiling complete chronological event timeline from Temporal history…',
      'Validating evidence citations against ground-truth logs and metrics…',
      'Exporting post-mortem to Slack and archiving into Supermemory.'
    ]
  }
];

/**
 * Filterable Enterprise Technology Stack Directory.
 */
const TECH_STACK_DATA = [
  { name: 'Temporal Server', category: 'orchestration', monogram: 'Tp', color: '#7C5CFC', role: 'Durable execution engine ensuring zero state loss and handling human approval signals.' },
  { name: 'Google ADK', category: 'intelligence', monogram: 'AD', color: '#4285F4', role: 'Parallel multi-agent reasoning framework utilizing typed Pydantic v2 schemas.' },
  { name: 'Prometheus', category: 'observability', monogram: 'Pm', color: '#E6522C', role: 'Time-series metrics engine driving non-LLM statistical anomaly detection.' },
  { name: 'Grafana Loki', category: 'observability', monogram: 'Lk', color: '#F5A623', role: 'Label-indexed log aggregation for fast stack-trace clustering.' },
  { name: 'CNCF Kepler', category: 'observability', monogram: 'Kp', color: '#FBBF24', role: 'eBPF-powered container energy telemetry to monitor carbon and power spikes.' },
  { name: 'Docker Sandbox', category: 'runtime', monogram: 'Dk', color: '#2496ED', role: 'Isolated ephemeral execution environments validating code diffs with replayed traffic.' },
  { name: 'Supermemory', category: 'intelligence', monogram: 'Sm', color: '#14B8A6', role: 'Vector database storing historical incident resolutions and alert noise patterns.' },
  { name: 'JarvisLabs GPUs', category: 'runtime', monogram: 'JL', color: '#76B900', role: 'Dedicated NVIDIA H100 GPU hosting providing 140+ token/s private LLM inference.' },
  { name: 'FastAPI Gateway', category: 'delivery', monogram: 'Fa', color: '#009688', role: 'Typed REST API gateway routing Slack webhooks and UI interactions into Temporal.' },
  { name: 'GitHub CI/CD', category: 'delivery', monogram: 'Gh', color: '#8B949E', role: 'Automated Draft Pull Request generator with attached sandbox verification proofs.' },
  { name: 'Slack & PagerDuty', category: 'delivery', monogram: 'Sl', color: '#E01E5A', role: 'Interactive alert notification pipeline providing 1-click engineer approval buttons.' },
  { name: 'PostgreSQL', category: 'orchestration', monogram: 'Pg', color: '#336791', role: 'Acid-compliant persistence store for Temporal workflow execution states and audit logs.' }
];

/* ==========================================================================
   2. TOPOLOGY VISUALIZER CONTROLLER
   ========================================================================== */

class TopologyRenderer {
  constructor(svgElementId) {
    this.svg = document.getElementById(svgElementId);
    this.ns = 'http://www.w3.org/2000/svg';
    this.nodeElements = new Map();
    this.edgeElements = new Map();
    this.packetPulse = null;
    this.init();
  }

  init() {
    if (!this.svg) return;
    this.renderEdges();
    this.renderNodes();
    this.createPacketPulse();
  }

  getNodeCenter(nodeId) {
    const node = ARCHITECTURE_NODES[nodeId];
    if (!node) return [0, 0];
    return [node.x + 104, node.y + 34];
  }

  renderEdges() {
    ARCHITECTURE_EDGES.forEach(edge => {
      const start = this.getNodeCenter(edge.from);
      const end = this.getNodeCenter(edge.to);
      const line = document.createElementNS(this.ns, 'line');
      line.setAttribute('x1', start[0]);
      line.setAttribute('y1', start[1]);
      line.setAttribute('x2', end[0]);
      line.setAttribute('y2', end[1]);
      line.setAttribute('class', 'svg-edge');
      line.setAttribute('id', `edge-${edge.from}-${edge.to}`);
      this.svg.appendChild(line);
      this.edgeElements.set(`${edge.from}-${edge.to}`, line);
    });
  }

  renderNodes() {
    Object.values(ARCHITECTURE_NODES).forEach(node => {
      const g = document.createElementNS(this.ns, 'g');
      g.setAttribute('class', 'svg-node idle');
      g.setAttribute('id', `node-${node.id}`);
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

      // Outer rounded box (208px wide for generous, no-overflow padding)
      const rect = document.createElementNS(this.ns, 'rect');
      rect.setAttribute('class', 'node-box');
      rect.setAttribute('width', 208);
      rect.setAttribute('height', 68);
      rect.setAttribute('rx', 12);
      g.appendChild(rect);

      // Monogram Badge Circle
      const badge = document.createElementNS(this.ns, 'circle');
      badge.setAttribute('cx', 24);
      badge.setAttribute('cy', 34);
      badge.setAttribute('r', 13);
      badge.setAttribute('fill', node.color);
      g.appendChild(badge);

      // Monogram Text
      const mono = document.createElementNS(this.ns, 'text');
      mono.setAttribute('x', 24);
      mono.setAttribute('y', 38);
      mono.setAttribute('text-anchor', 'middle');
      mono.setAttribute('fill', '#FFFFFF');
      mono.setAttribute('font-family', 'var(--font-display)');
      mono.setAttribute('font-weight', '800');
      mono.setAttribute('font-size', '10px');
      mono.textContent = node.monogram;
      g.appendChild(mono);

      // Node Name Label
      const title = document.createElementNS(this.ns, 'text');
      title.setAttribute('x', 46);
      title.setAttribute('y', 30);
      title.setAttribute('fill', '#FFFFFF');
      title.setAttribute('font-family', 'var(--font-display)');
      title.setAttribute('font-weight', '700');
      title.setAttribute('font-size', '11.5px');
      title.textContent = node.name;
      g.appendChild(title);

      // Subtitle / Tech Tag
      const subtitle = document.createElementNS(this.ns, 'text');
      subtitle.setAttribute('x', 46);
      subtitle.setAttribute('y', 47);
      subtitle.setAttribute('fill', 'var(--color-text-secondary)');
      subtitle.setAttribute('font-family', 'var(--font-mono)');
      subtitle.setAttribute('font-size', '9.5px');
      subtitle.textContent = node.subtitle;
      g.appendChild(subtitle);

      // Interactive Click to open detailed modal
      g.addEventListener('click', () => {
        if (window.modalController) {
          window.modalController.open(node.id);
        }
      });

      this.svg.appendChild(g);
      this.nodeElements.set(node.id, g);
    });
  }

  createPacketPulse() {
    const pulse = document.createElementNS(this.ns, 'circle');
    pulse.setAttribute('r', 7);
    pulse.setAttribute('fill', '#FF5C35');
    pulse.setAttribute('opacity', '0');
    pulse.style.filter = 'drop-shadow(0 0 10px #FF5C35)';
    pulse.style.pointerEvents = 'none';
    this.svg.appendChild(pulse);
    this.packetPulse = pulse;
  }

  animatePulse(fromId, toId, durationMs = 600) {
    if (!this.packetPulse) return;
    const start = this.getNodeCenter(fromId);
    const end = this.getNodeCenter(toId);
    const pulse = this.packetPulse;
    const startTime = performance.now();

    pulse.setAttribute('opacity', '1');

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Fluid spring-like ease
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentX = start[0] + (end[0] - start[0]) * ease;
      const currentY = start[1] + (end[1] - start[1]) * ease;

      pulse.setAttribute('cx', currentX);
      pulse.setAttribute('cy', currentY);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        pulse.setAttribute('opacity', '0');
      }
    }

    requestAnimationFrame(step);
  }

  updateStage(activeNodeIds, primaryEdge, status) {
    // Reset all nodes
    this.nodeElements.forEach((el, id) => {
      el.setAttribute('class', 'svg-node idle');
    });

    // Reset all edges
    this.edgeElements.forEach(el => {
      el.setAttribute('class', 'svg-edge');
    });

    // Highlight active nodes
    activeNodeIds.forEach(id => {
      const el = this.nodeElements.get(id);
      if (el) {
        let nodeClass = 'running';
        if (status === 'anomaly') nodeClass = 'fault';
        else if (status === 'waiting') nodeClass = 'waiting';
        else if (status === 'resolved') nodeClass = 'verified';

        el.setAttribute('class', `svg-node ${nodeClass}`);
      }
    });

    // Highlight active edge and dispatch packet animation
    if (primaryEdge && primaryEdge.from && primaryEdge.to) {
      const edgeKey = `${primaryEdge.from}-${primaryEdge.to}`;
      const edgeEl = this.edgeElements.get(edgeKey);
      if (edgeEl) {
        edgeEl.setAttribute('class', status === 'resolved' ? 'svg-edge verified-edge' : 'svg-edge active');
      }
      this.animatePulse(primaryEdge.from, primaryEdge.to, 550);
    }
  }

  highlightSingleNode(nodeId) {
    this.nodeElements.forEach((el, id) => {
      if (id === nodeId) {
        el.setAttribute('class', 'svg-node running');
      } else {
        el.setAttribute('class', 'svg-node idle dimmed');
      }
    });
  }

  resetHighlights() {
    this.nodeElements.forEach(el => {
      el.setAttribute('class', 'svg-node idle');
    });
  }
}

/* ==========================================================================
   3. REAL-TIME METRICS CANVAS CHART RENDERER
   ========================================================================== */

class MetricsChartRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.history = [];
    this.maxPoints = 45;
    this.targetLatency = 0.3;
    this.currentLatency = 0.3;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startLoop();
  }

  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
    this.height = this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
  }

  setTargetMetrics(latencyValue) {
    this.targetLatency = latencyValue;
  }

  startLoop() {
    const render = () => {
      // Smooth interpolation toward target
      this.currentLatency += (this.targetLatency - this.currentLatency) * 0.12;
      const noise = (Math.random() - 0.5) * 0.04;
      this.history.push(Math.max(0.15, this.currentLatency + noise));

      if (this.history.length > this.maxPoints) {
        this.history.shift();
      }

      this.draw();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Draw baseline threshold line (0.3s)
    const baselineY = h - (0.3 / 3.0) * h * 0.85;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1 * window.devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(w, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.history.length < 2) return;

    const stepX = w / (this.maxPoints - 1);
    const isAnomaly = this.currentLatency > 1.2;

    // Line Path
    ctx.beginPath();
    this.history.forEach((val, i) => {
      const normalized = Math.min(val / 3.0, 1);
      const x = i * stepX;
      const y = h - normalized * (h * 0.85) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = isAnomaly ? '#FF3B5C' : '#00D4FF';
    ctx.lineWidth = 2.5 * window.devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Subtle area gradient underneath
    ctx.lineTo((this.history.length - 1) * stepX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isAnomaly ? 'rgba(255, 59, 92, 0.25)' : 'rgba(0, 212, 255, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

/* ==========================================================================
   4. INCIDENT SIMULATION ENGINE CONTROLLER
   ========================================================================== */

class IncidentEngine {
  constructor(topologyRenderer, metricsChart) {
    this.topology = topologyRenderer;
    this.metrics = metricsChart;
    this.currentIndex = 0;
    this.isPlaying = false; // Start in manual control mode: user has 100% control!
    this.speedMultiplier = 1;
    this.timer = null;

    // UI Element Cache - Simulator Section
    this.stageCounterEl = document.getElementById('stage-counter');
    this.stageTitleEl = document.getElementById('stage-title');
    this.stageDescEl = document.getElementById('stage-desc');
    this.stageBadgeEl = document.getElementById('stage-badge');
    this.terminalLogsEl = document.getElementById('terminal-logs');
    this.slackCardEl = document.getElementById('slack-card');
    this.slackMessageEl = document.getElementById('slack-message');
    this.githubPrCardEl = document.getElementById('github-pr-card');
    this.prDiffEl = document.getElementById('pr-diff-content');
    this.playBtnEl = document.getElementById('play-btn');
    this.prevBtnEl = document.getElementById('prev-btn');
    this.nextBtnEl = document.getElementById('next-btn');
    this.resetBtnEl = document.getElementById('reset-btn');
    this.timelineStepperEl = document.getElementById('stepper-timeline');
    this.gpuActivityMeterEl = document.getElementById('gpu-activity-meter');

    // UI Element Cache - Topology Interactive Console & Canvas
    this.topoStepCounterEl = document.getElementById('topo-step-counter');
    this.topoStepBadgeEl = document.getElementById('topo-step-badge');
    this.topoModePillEl = document.getElementById('topo-mode-pill');
    this.topoStepTitleEl = document.getElementById('topo-step-title');
    this.topoStepDescEl = document.getElementById('topo-step-desc');
    this.topoFlowTextEl = document.getElementById('topo-flow-text');
    this.topoScrubberEl = document.getElementById('topo-scrubber-pills');
    this.topoPlayBtnEl = document.getElementById('topo-play-btn');
    this.topoPrevBtnEl = document.getElementById('topo-prev-btn');
    this.topoNextBtnEl = document.getElementById('topo-next-btn');
    this.topoResetBtnEl = document.getElementById('topo-reset-btn');
    this.canvasPrevBtnEl = document.getElementById('canvas-prev-btn');
    this.canvasNextBtnEl = document.getElementById('canvas-next-btn');

    this.init();
  }

  init() {
    this.renderScrubbersAndDots();
    this.bindControls();
    this.renderGpuMeter();
    this.goToStep(0);
    this.pause(); // Ensure initial state is cleanly paused for user control!
  }

  renderScrubbersAndDots() {
    // 1. Render 10 Scrubber Pills on Topology Console
    if (this.topoScrubberEl) {
      this.topoScrubberEl.innerHTML = '';
      SIMULATION_STAGES.forEach((stage, idx) => {
        const btn = document.createElement('button');
        btn.className = 'topo-scrubber-btn';
        btn.setAttribute('type', 'button');
        btn.setAttribute('title', `Step ${stage.step}: ${stage.title}`);
        btn.innerHTML = `
          <span class="scrubber-num">${String(stage.step).padStart(2, '0')}</span>
          <span class="scrubber-label">${stage.shortLabel || stage.title}</span>
        `;
        btn.addEventListener('click', () => {
          this.pause();
          this.goToStep(idx);
        });
        this.topoScrubberEl.appendChild(btn);
      });
    }

    // 2. Render dots on Simulator Stepper Timeline
    if (this.timelineStepperEl) {
      this.timelineStepperEl.innerHTML = '';
      SIMULATION_STAGES.forEach((stage, idx) => {
        const dot = document.createElement('div');
        dot.className = 'step-indicator';
        dot.setAttribute('title', `Stage ${stage.step}: ${stage.title}`);
        dot.addEventListener('click', () => {
          this.pause();
          this.goToStep(idx);
        });
        this.timelineStepperEl.appendChild(dot);
      });
    }
  }

  renderGpuMeter() {
    if (!this.gpuActivityMeterEl) return;
    this.gpuActivityMeterEl.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const cell = document.createElement('div');
      cell.className = 'gpu-cell';
      this.gpuActivityMeterEl.appendChild(cell);
    }
  }

  updateGpuMeter(isActive) {
    if (!this.gpuActivityMeterEl) return;
    const cells = this.gpuActivityMeterEl.querySelectorAll('.gpu-cell');
    cells.forEach((cell, idx) => {
      if (isActive) {
        setTimeout(() => cell.classList.add('active'), idx * 30);
      } else {
        cell.classList.remove('active');
      }
    });
  }

  bindControls() {
    const speed1x = document.getElementById('speed-1x');
    const speed2x = document.getElementById('speed-2x');

    const handleNext = () => {
      this.pause();
      this.goToStep((this.currentIndex + 1) % SIMULATION_STAGES.length);
    };

    const handlePrev = () => {
      this.pause();
      this.goToStep((this.currentIndex - 1 + SIMULATION_STAGES.length) % SIMULATION_STAGES.length);
    };

    const handlePlayToggle = () => {
      if (this.isPlaying) this.pause();
      else this.play();
    };

    const handleReset = () => {
      this.pause();
      this.goToStep(0);
    };

    // Bind Simulator controls
    if (this.playBtnEl) this.playBtnEl.addEventListener('click', handlePlayToggle);
    if (this.prevBtnEl) this.prevBtnEl.addEventListener('click', handlePrev);
    if (this.nextBtnEl) this.nextBtnEl.addEventListener('click', handleNext);
    if (this.resetBtnEl) this.resetBtnEl.addEventListener('click', handleReset);

    // Bind Topology controls
    if (this.topoPlayBtnEl) this.topoPlayBtnEl.addEventListener('click', handlePlayToggle);
    if (this.topoPrevBtnEl) this.topoPrevBtnEl.addEventListener('click', handlePrev);
    if (this.topoNextBtnEl) this.topoNextBtnEl.addEventListener('click', handleNext);
    if (this.topoResetBtnEl) this.topoResetBtnEl.addEventListener('click', handleReset);

    // Bind SVG Canvas Floating Arrow buttons
    if (this.canvasPrevBtnEl) this.canvasPrevBtnEl.addEventListener('click', handlePrev);
    if (this.canvasNextBtnEl) this.canvasNextBtnEl.addEventListener('click', handleNext);

    // Keyboard Shortcuts: ArrowRight (Next Step), ArrowLeft (Prev Step), Space (Play/Pause)
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ' && !e.target.closest('button')) {
        e.preventDefault();
        handlePlayToggle();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleReset();
      }
    });

    if (speed1x && speed2x) {
      speed1x.addEventListener('click', () => {
        this.speedMultiplier = 1;
        speed1x.classList.add('active');
        speed2x.classList.remove('active');
      });
      speed2x.addEventListener('click', () => {
        this.speedMultiplier = 2;
        speed2x.classList.add('active');
        speed1x.classList.remove('active');
      });
    }
  }

  play() {
    this.isPlaying = true;
    [this.playBtnEl, this.topoPlayBtnEl].forEach(btn => {
      if (btn) btn.innerHTML = '<span class="btn-icon">⏸</span><span class="btn-text">Pause</span>';
    });
    if (this.topoModePillEl) {
      this.topoModePillEl.textContent = 'AUTO-LOOP ACTIVE';
      this.topoModePillEl.classList.add('auto-active');
    }
    this.scheduleNext();
  }

  pause() {
    this.isPlaying = false;
    [this.playBtnEl, this.topoPlayBtnEl].forEach(btn => {
      if (btn) btn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">Auto-Play</span>';
    });
    if (this.topoModePillEl) {
      this.topoModePillEl.textContent = 'MANUAL STEP MODE';
      this.topoModePillEl.classList.remove('auto-active');
    }
    clearTimeout(this.timer);
  }

  scheduleNext() {
    clearTimeout(this.timer);
    if (!this.isPlaying) return;
    const baseDuration = 4500;
    const duration = baseDuration / this.speedMultiplier;
    this.timer = setTimeout(() => {
      this.goToStep((this.currentIndex + 1) % SIMULATION_STAGES.length);
    }, duration);
  }

  goToStep(index) {
    this.currentIndex = index;
    const stage = SIMULATION_STAGES[index];

    // 1. Update Simulator Stage Banner Information
    if (this.stageCounterEl) {
      this.stageCounterEl.textContent = `Stage ${stage.step} of ${SIMULATION_STAGES.length}`;
    }
    if (this.stageTitleEl) {
      this.stageTitleEl.textContent = stage.title;
    }
    if (this.stageDescEl) {
      this.stageDescEl.textContent = stage.description;
    }
    if (this.stageBadgeEl) {
      this.stageBadgeEl.className = `stage-badge-status ${stage.status}`;
      this.stageBadgeEl.textContent = stage.status.toUpperCase();
    }

    // 2. Update Topology Interactive Console
    if (this.topoStepCounterEl) {
      this.topoStepCounterEl.textContent = `STAGE ${stage.step} / ${SIMULATION_STAGES.length}`;
    }
    if (this.topoStepTitleEl) {
      this.topoStepTitleEl.textContent = stage.title;
    }
    if (this.topoStepDescEl) {
      this.topoStepDescEl.textContent = stage.description;
    }
    if (this.topoStepBadgeEl) {
      this.topoStepBadgeEl.className = `topo-status-badge ${stage.status}`;
      let badgeLabel = 'ACTIVE INGEST';
      if (stage.status === 'anomaly') badgeLabel = 'FAULT DETECTED';
      else if (stage.status === 'processing') badgeLabel = 'REASONING PIPELINE';
      else if (stage.status === 'waiting') badgeLabel = 'HUMAN REVIEW REQUIRED';
      else if (stage.status === 'resolved') badgeLabel = 'SANDBOX PASS / VERIFIED';
      this.topoStepBadgeEl.textContent = badgeLabel;
    }

    // 3. Update Active Telemetry Flow route text on Canvas Footer
    if (this.topoFlowTextEl && stage.edge) {
      const fromNode = ARCHITECTURE_NODES[stage.edge.from];
      const toNode = ARCHITECTURE_NODES[stage.edge.to];
      if (fromNode && toNode) {
        this.topoFlowTextEl.textContent = `${fromNode.name} [${fromNode.monogram}] ──▶ ${toNode.name} [${toNode.monogram}]`;
      }
    }

    // 4. Update 10 Scrubber Buttons on Topology Console
    if (this.topoScrubberEl) {
      const scrubBtns = this.topoScrubberEl.querySelectorAll('.topo-scrubber-btn');
      scrubBtns.forEach((btn, idx) => {
        btn.classList.remove('active', 'completed');
        if (idx === index) btn.classList.add('active');
        else if (idx < index) btn.classList.add('completed');
      });
    }

    // 5. Update Stepper Indicators on Simulator Timeline
    if (this.timelineStepperEl) {
      const indicators = this.timelineStepperEl.querySelectorAll('.step-indicator');
      indicators.forEach((dot, idx) => {
        dot.className = 'step-indicator';
        if (idx === index) dot.classList.add('active');
        else if (idx < index) dot.classList.add('completed');
      });
    }

    // 6. Update Architecture Topology Graph (nodes & pulsing edge)
    this.topology.updateStage(stage.activeNodes, stage.edge, stage.status);

    // 7. Update Real-Time Metrics Canvas Target
    this.metrics.setTargetMetrics(stage.metrics.p99);

    // 8. Append Telemetry Log to Terminal Window
    this.appendLog(stage.log.level, stage.log.text);

    // 9. Update Slack Interactive Alert Card
    if (this.slackCardEl && stage.slack) {
      this.slackCardEl.className = `slack-interactive-card ${stage.slack.alertClass}`;
      if (this.slackMessageEl) {
        this.slackMessageEl.innerHTML = stage.slack.message;
      }
    }

    // 10. Update GitHub Pull Request Card with Diff
    if (this.githubPrCardEl) {
      if (stage.pr && stage.pr.visible) {
        this.githubPrCardEl.style.display = 'block';
        this.githubPrCardEl.classList.add('active-pr');
        if (this.prDiffEl && stage.pr.diff) {
          this.prDiffEl.textContent = stage.pr.diff;
        }
      } else {
        this.githubPrCardEl.classList.remove('active-pr');
      }
    }

    // 11. Update GPU hardware state
    const isGpuActive = stage.activeNodes.includes('gem');
    this.updateGpuMeter(isGpuActive);

    // Schedule next step ONLY if user explicitly enabled auto-loop mode
    if (this.isPlaying) {
      this.scheduleNext();
    }
  }

  appendLog(level, text) {
    if (!this.terminalLogsEl) return;
    const line = document.createElement('div');
    line.className = 'terminal-log-line';

    const timestamp = new Date().toISOString().slice(11, 19);
    line.innerHTML = `
      <span class="log-ts">${timestamp}</span>
      <span class="log-level ${level}">[${level.toUpperCase()}]</span>
      <span class="log-msg">${text}</span>
    `;

    this.terminalLogsEl.prepend(line);
    // Limit log line depth for crisp performance
    if (this.terminalLogsEl.children.length > 25) {
      this.terminalLogsEl.lastChild.remove();
    }
  }
}

/* ==========================================================================
   5. GOOGLE ADK AGENT REASONING STUDIO CONTROLLER
   ========================================================================== */

class AgentStudio {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.init();
  }

  init() {
    if (!this.container) return;
    this.container.innerHTML = '';

    ADK_AGENTS.forEach((agent, agentIdx) => {
      const card = document.createElement('div');
      card.className = 'agent-card';

      const toolsMarkup = agent.tools
        .map(tool => `<span class="tool-tag">${tool}</span>`)
        .join('');

      card.innerHTML = `
        <div class="agent-card-header">
          <div>
            <h4 class="agent-title">${agent.name}</h4>
            <span class="agent-schema-badge">${agent.schema}</span>
          </div>
        </div>
        <p class="agent-role">${agent.role}</p>
        <div class="agent-tools-list">${toolsMarkup}</div>
        <div class="agent-thought-stream" id="thought-stream-${agentIdx}">
          ${agent.thoughts[0]}
        </div>
      `;

      this.container.appendChild(card);

      // Periodically rotate thoughts with natural offsets
      let thoughtPointer = 0;
      setInterval(() => {
        thoughtPointer = (thoughtPointer + 1) % agent.thoughts.length;
        const streamEl = document.getElementById(`thought-stream-${agentIdx}`);
        if (streamEl) {
          streamEl.textContent = agent.thoughts[thoughtPointer];
        }
      }, 3200 + agentIdx * 650);
    });
  }
}

/* ==========================================================================
   6. ENTERPRISE TECHNOLOGY STACK DIRECTORY
   ========================================================================== */

class TechStackFilter {
  constructor(tabsContainerId, gridContainerId, topologyRenderer) {
    this.tabsContainer = document.getElementById(tabsContainerId);
    this.gridContainer = document.getElementById(gridContainerId);
    this.topology = topologyRenderer;
    this.currentCategory = 'all';
    this.init();
  }

  init() {
    if (!this.gridContainer) return;
    this.renderCards(TECH_STACK_DATA);
    this.bindTabs();
  }

  bindTabs() {
    if (!this.tabsContainer) return;
    const tabs = this.tabsContainer.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        this.filter(filter);
      });
    });
  }

  filter(category) {
    this.currentCategory = category;
    const filtered = category === 'all'
      ? TECH_STACK_DATA
      : TECH_STACK_DATA.filter(item => item.category === category);
    this.renderCards(filtered);
  }

  renderCards(data) {
    this.gridContainer.innerHTML = '';
    data.forEach(tech => {
      const card = document.createElement('div');
      card.className = 'tech-card';
      card.style.setProperty('--tech-accent', tech.color);

      card.innerHTML = `
        <div class="tech-card-header">
          <div class="tech-monogram">${tech.monogram}</div>
          <div class="tech-meta">
            <h4>${tech.name}</h4>
            <span class="tech-category-tag">${tech.category.toUpperCase()}</span>
          </div>
        </div>
        <p class="tech-description">${tech.role}</p>
      `;

      // Highlight in topology on hover
      card.addEventListener('mouseenter', () => {
        const matchingNodeId = Object.keys(ARCHITECTURE_NODES).find(
          id => ARCHITECTURE_NODES[id].name.toLowerCase().includes(tech.name.toLowerCase().split(' ')[0])
        );
        if (matchingNodeId && this.topology) {
          this.topology.highlightSingleNode(matchingNodeId);
        }
      });

      card.addEventListener('mouseleave', () => {
        if (this.topology) {
          this.topology.resetHighlights();
        }
      });

      this.gridContainer.appendChild(card);
    });
  }
}

/* ==========================================================================
   7. NODE SPECIFICATION MODAL CONTROLLER
   ========================================================================== */

class ModalController {
  constructor() {
    this.backdrop = document.getElementById('node-modal');
    this.titleEl = document.getElementById('modal-node-title');
    this.subtitleEl = document.getElementById('modal-node-subtitle');
    this.monogramEl = document.getElementById('modal-node-monogram');
    this.specGridEl = document.getElementById('modal-spec-grid');
    this.closeBtn = document.getElementById('modal-close-btn');
    this.dismissBtn = document.getElementById('modal-dismiss-btn');

    this.bindEvents();
  }

  bindEvents() {
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.dismissBtn) this.dismissBtn.addEventListener('click', () => this.close());
    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) this.close();
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.backdrop && this.backdrop.classList.contains('is-open')) {
        this.close();
      }
    });
  }

  open(nodeId) {
    const node = ARCHITECTURE_NODES[nodeId];
    if (!node || !this.backdrop) return;

    if (this.titleEl) this.titleEl.textContent = node.name;
    if (this.subtitleEl) this.subtitleEl.textContent = `${node.category} · ${node.subtitle}`;
    if (this.monogramEl) {
      this.monogramEl.textContent = node.monogram;
      this.monogramEl.style.backgroundColor = node.color;
    }

    if (this.specGridEl) {
      this.specGridEl.innerHTML = `
        <div class="spec-label">Executive Purpose</div>
        <div class="spec-value">${node.purpose}</div>

        <div class="spec-label">Ingress Schemas</div>
        <div class="spec-value"><code>${node.inputSchema}</code></div>

        <div class="spec-label">Egress Contracts</div>
        <div class="spec-value"><code>${node.outputSchema}</code></div>

        <div class="spec-label">Resiliency & Sagas</div>
        <div class="spec-value">${node.resiliency}</div>

        <div class="spec-label">Underlying Stack</div>
        <div class="spec-value">${node.techStack}</div>

        <div class="spec-label">Architectural Advantage</div>
        <div class="spec-value"><strong>${node.advantages}</strong></div>
      `;
    }

    this.backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (!this.backdrop) return;
    this.backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }
}

/* ==========================================================================
   8. APPLICATION LIFECYCLE BOOTSTRAP
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Architecture Visualizer
  const topology = new TopologyRenderer('topology-svg');

  // Initialize Real-Time Metrics Canvas Chart
  const metricsChart = new MetricsChartRenderer('metrics-canvas');

  // Initialize Incident Simulation Engine
  const incidentEngine = new IncidentEngine(topology, metricsChart);

  // Initialize ADK Reasoning Studio
  const agentStudio = new AgentStudio('adk-agents-grid');

  // Initialize Modal Controller
  window.modalController = new ModalController();

  // Initialize Tech Stack Filter
  const techFilter = new TechStackFilter('tech-filter-tabs', 'tech-stack-grid', topology);

  // Live Top Navigation Ticker Tick
  const tickerEl = document.getElementById('ticker-log-preview');
  if (tickerEl) {
    const tickerLines = [
      'Prometheus scrapers running: checkout-node healthy (p99: 0.28s)',
      'Temporal MonitorWorkflow active (cadence: 30s, 0 active anomalies)',
      'Supermemory vector store synced (842 incident cases indexed)',
      'Docker sandbox daemon idle (0 active test containers)',
      'JarvisLabs H100 inference warm (LiteLLM latency: 18ms)'
    ];
    let tickerIdx = 0;
    setInterval(() => {
      tickerIdx = (tickerIdx + 1) % tickerLines.length;
      tickerEl.textContent = tickerLines[tickerIdx];
    }, 4000);
  }
});
