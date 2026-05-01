export type AssistantPreset = {
  id: string;
  avatar: string;
  presetAgentType?: string;
  enabled?: boolean;
  /**
   * Directory containing all resources for this preset (relative to project root).
   * If set, both ruleFiles and skillFiles will be resolved from this directory.
   * Default: rules/ for rules, skills/ for skills
   */
  resourceDir?: string;
  ruleFiles: Record<string, string>;
  skillFiles?: Record<string, string>;
  /**
   * Default enabled skills for this assistant (skill names from skills/ directory).
   * 此助手默认启用的技能列表（来自 skills/ 目录的技能名称）
   */
  defaultEnabledSkills?: string[];
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promptsI18n?: Record<string, string[]>;
};

export const ASSISTANT_PRESETS: AssistantPreset[] = [
  {
    id: 'word-creator',
    avatar: 'DocDetail',
    enabled: true,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/word-creator',
    ruleFiles: {
      'en-US': 'word-creator.md',
    },
    defaultEnabledSkills: ['officecli-docx'],
    nameI18n: {
      'en-US': 'Word Creator',
    },
    descriptionI18n: {
      'en-US':
        'Create, edit, and analyze professional Word documents with officecli. Reports, proposals, letters, memos, and more.',
    },
    promptsI18n: {
      'en-US': [
        'Create a Q1 2026 quarterly report with TOC, financial highlights table, revenue trend chart, and KPI metrics section',
        'Write an academic research paper on machine learning with LaTeX equations, citations, data tables, and bibliography',
        'Create a project status report with DRAFT watermark, color-coded status table, and a Gantt timeline in landscape section',
      ],
    },
  },
  {
    id: 'ppt-creator',
    avatar: 'Ppt',
    enabled: true,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/ppt-creator',
    ruleFiles: {
      'en-US': 'ppt-creator.md',
    },
    defaultEnabledSkills: ['officecli-pptx'],
    nameI18n: {
      'en-US': 'PPT Creator',
    },
    descriptionI18n: {
      'en-US':
        'Create, edit, and analyze professional PowerPoint presentations with officecli. Bold designs, varied layouts, and visual impact.',
    },
    promptsI18n: {
      'en-US': [
        'Create a 10-slide Kubernetes migration proposal with architecture comparison, cost analysis, and migration timeline',
        'Create a 10-slide SaaS analytics dashboard for a project management tool with user growth charts, conversion funnel, and competitive landscape',
        'Create a 10-slide fintech product roadmap for a digital payment platform with user growth trajectory and investment analysis',
      ],
    },
  },
  {
    id: 'excel-creator',
    avatar: 'TableReport',
    enabled: true,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/excel-creator',
    ruleFiles: {
      'en-US': 'excel-creator.md',
    },
    defaultEnabledSkills: ['officecli-xlsx'],
    nameI18n: {
      'en-US': 'Excel Creator',
    },
    descriptionI18n: {
      'en-US':
        'Create, edit, and analyze professional Excel spreadsheets with officecli. Financial models, dashboards, trackers, and data analysis.',
    },
    promptsI18n: {
      'en-US': [
        'Build a 3-sheet financial dashboard with income statement, revenue breakdown chart, and conditional formatting for variances',
        'Create a sales pipeline tracker with deal stages, weighted pipeline formulas, funnel chart, and rep performance scorecards',
        'Create a budget tracker with cross-sheet variance formulas, budget vs actuals bar chart, and color-coded over-budget highlights',
      ],
    },
  },
  {
    id: 'morph-ppt',
    avatar: 'Slide',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/morph-ppt',
    ruleFiles: {
      'en-US': 'morph-ppt.md',
    },
    defaultEnabledSkills: ['morph-ppt'],
    nameI18n: {
      'en-US': 'Morph PPT',
    },
    descriptionI18n: {
      'en-US':
        'Create professional Morph-animated presentations with officecli. Supports multiple visual styles and end-to-end workflow from topic to polished slides.',
    },
    promptsI18n: {
      'en-US': [
        'Pick a fun topic yourself and create a complete PPT',
        'Create the most beautiful PPT you can imagine, topic is up to you',
        'Create a coffee brand introduction PPT with a minimalist premium feel',
      ],
    },
  },
  {
    id: 'morph-ppt-3d',
    avatar: 'Cube',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/morph-ppt-3d',
    ruleFiles: {
      'en-US': 'morph-ppt-3d.md',
    },
    defaultEnabledSkills: ['morph-ppt-3d', 'morph-ppt'],
    nameI18n: {
      'en-US': '3D Morph PPT',
    },
    descriptionI18n: {
      'en-US':
        "Turn a GLB 3D model into a cinematic Morph presentation. The model is the visual hero — close-up for details, bird's eye for structure, low angle for drama, with smooth Morph transitions between every shot. Note: 3D models and Morph transitions require Microsoft PowerPoint to display correctly.",
    },
    promptsI18n: {
      'en-US': [
        "Use this GLB model to create a product showcase. Content should revolve around the model — what it is, its features, its story. Each slide shows a different angle that matches the topic: close-up for details, bird's eye for structure, dramatic low angle for the climax.",
        'Here is my GLB model. Study it carefully, then create a cinematic presentation where the model is the hero of every frame. I want varied camera work: push in for detail shots, pull back for overview, bleed the model off the edge for dramatic transitions.',
        "Build a presentation around this 3D model that feels like a movie trailer. Big dramatic moments, intimate close-ups, sweeping overview shots. The story should match what the model actually is — don't just add generic text.",
      ],
    },
  },
  {
    id: 'pitch-deck-creator',
    avatar: 'Slide',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/pitch-deck-creator',
    ruleFiles: {
      'en-US': 'pitch-deck-creator.md',
    },
    defaultEnabledSkills: ['officecli-pitch-deck'],
    nameI18n: {
      'en-US': 'Pitch Deck Creator',
    },
    descriptionI18n: {
      'en-US':
        'Build investor pitch decks, product launch presentations, and enterprise sales decks with gradient designs, data charts, competitive tables, team slides, and speaker notes. Supports seed to Series A+ decks.',
    },
    promptsI18n: {
      'en-US': [
        'Create a 12-slide Series A investor deck for a B2B SaaS data pipeline startup with ARR charts, competitive comparison table, team avatars, and financial projections',
        'Create an 8-slide product launch deck for an AI code review tool with 5 feature icons, before/after comparison, customer satisfaction doughnut chart, and 3-tier pricing table',
        'Create a 10-slide enterprise sales deck for a cybersecurity platform with ROI analysis, radar chart vs competitors, financial impact table, and implementation timeline',
      ],
    },
  },
  {
    id: 'dashboard-creator',
    avatar: 'ChartGraph',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/dashboard-creator',
    ruleFiles: {
      'en-US': 'dashboard-creator.md',
    },
    defaultEnabledSkills: ['officecli-data-dashboard'],
    nameI18n: {
      'en-US': 'Dashboard Creator',
    },
    descriptionI18n: {
      'en-US':
        'Turn CSV or tabular data into polished Excel dashboards with KPI cards, charts linked to live data, sparklines, and conditional formatting. Automatically scales complexity to dataset size — from quick summaries to full analytics panels.',
    },
    promptsI18n: {
      'en-US': [
        'Create a SaaS MRR dashboard with 12 months of sample data — show MRR trend, month-over-month growth, and churn breakdown for a board meeting',
        'Build an e-commerce regional sales dashboard with sample data across 5 regions: revenue by region, weekly trends, and category split',
        'Make a budget-vs-actuals dashboard for 8 departments showing variance indicators and over/under-budget status',
      ],
    },
  },
  {
    id: 'academic-paper',
    avatar: 'BookOpen',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/academic-paper',
    ruleFiles: {
      'en-US': 'academic-paper.md',
    },
    defaultEnabledSkills: ['officecli-academic-paper'],
    nameI18n: {
      'en-US': 'Academic Paper',
    },
    descriptionI18n: {
      'en-US':
        'Create formally structured academic papers, research papers, and white papers with native Word TOC, LaTeX-to-OMML equations, scholarly bibliography (APA/Physics/Chicago), footnotes, multi-column layouts, and paper-type-specific styling.',
    },
    promptsI18n: {
      'en-US': [
        'Create a white paper on rural EV charging infrastructure with executive summary, data tables, footnotes, CONFIDENTIAL watermark, and professional headers',
        'Write a physics paper on topological insulators with display equations, multi-column abstract, theorem/definition blocks, and landscape figures',
        'Create an APA-style research paper on organizational culture with 3 data tables, endnotes, 15 references with hanging indent, and double spacing',
      ],
    },
  },
  {
    id: 'financial-model-creator',
    avatar: 'Finance',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/financial-model-creator',
    ruleFiles: {
      'en-US': 'financial-model-creator.md',
    },
    defaultEnabledSkills: ['officecli-financial-model'],
    nameI18n: {
      'en-US': 'Financial Model Creator',
    },
    descriptionI18n: {
      'en-US':
        'Build formula-driven financial models from text prompts: 3-statement models, DCF valuations, cap tables, scenario analyses, sensitivity tables, and debt schedules. All values flow from assumptions through interconnected formula chains.',
    },
    promptsI18n: {
      'en-US': [
        'Build a 3-year SaaS financial model with income statement, balance sheet, cash flow, and dashboard charts',
        'Create a DCF valuation for a manufacturing company with WACC calculation and sensitivity table',
        'Build a cap table with seed and Series A rounds, liquidation preferences, and exit waterfall analysis',
      ],
    },
  },
  {
    id: 'star-office-helper',
    avatar: 'Tv',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/star-office-helper',
    ruleFiles: {
      'en-US': 'star-office-helper.md',
    },
    defaultEnabledSkills: ['star-office-helper'],
    nameI18n: {
      'en-US': 'Star Office Helper',
    },
    descriptionI18n: {
      'en-US': 'Install, connect, and troubleshoot Star-Office-UI visualization for Aion preview.',
    },
    promptsI18n: {
      'en-US': [
        'Set up Star Office on my machine',
        'Fix Unauthorized on Star Office page',
        'Connect Aion preview to http://127.0.0.1:19000',
      ],
    },
  },
  {
    id: 'cowork',
    avatar: 'cowork.svg',
    enabled: true,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/cowork',
    ruleFiles: {
      'en-US': 'cowork.md',
    },
    skillFiles: {
      'en-US': 'cowork-skills.md',
    },
    defaultEnabledSkills: ['skill-creator', 'officecli-pptx', 'officecli-docx', 'pdf', 'officecli-xlsx'],
    nameI18n: {
      'en-US': 'Cowork',
    },
    descriptionI18n: {
      'en-US': 'Autonomous task execution with file operations, document processing, and multi-step workflow planning.',
    },
    promptsI18n: {
      'en-US': [
        'Analyze the current project structure and suggest improvements',
        'Automate the build and deployment process',
        'Extract and summarize key information from all PDF files',
      ],
    },
  },
  // Deprecated: replaced by ppt-creator (officecli-based)
  // {
  //   id: 'pptx-generator',
  //   avatar: '📊',
  //   presetAgentType: 'gemini',
  //   resourceDir: 'src/process/resources/assistant/pptx-generator',
  //   ruleFiles: {
  //     'en-US': 'pptx-generator.md',
  //     'zh-TW': 'pptx-generator.zh-TW.md',
  //   },
  //   nameI18n: {
  //     'en-US': 'PPTX Generator',
  //     'zh-TW': 'PPTX 生成器',
  //   },
  //   descriptionI18n: {
  //     'en-US': 'Generate local PPTX assets and structure for pptxgenjs.',
  //     'zh-TW': '生成本地 PPTX 资产与结构（pptxgenjs）。',
  //   },
  //   promptsI18n: {
  //     'en-US': [
  //       'Create a professional slide deck about AI trends with 10 slides',
  //       'Generate a quarterly business report presentation',
  //       'Make a product launch presentation with visual elements',
  //     ],
  //     'zh-TW': ['创建一个包含 10 页的专业 AI 趋势幻灯片', '生成季度业务报告演示文稿', '制作包含视觉元素的产品发布演示'],
  //   },
  // },
  // Deprecated: replaced by ppt-creator (officecli-based)
  // {
  //   id: 'pdf-to-ppt',
  //   avatar: '📄',
  //   presetAgentType: 'gemini',
  //   resourceDir: 'src/process/resources/assistant/pdf-to-ppt',
  //   ruleFiles: {
  //     'en-US': 'pdf-to-ppt.md',
  //     'zh-TW': 'pdf-to-ppt.zh-TW.md',
  //   },
  //   nameI18n: {
  //     'en-US': 'PDF to PPT',
  //     'zh-TW': 'PDF 转 PPT',
  //   },
  //   descriptionI18n: {
  //     'en-US': 'Convert PDF to PPT with watermark removal rules.',
  //     'zh-TW': 'PDF 转 PPT 并去除水印规则',
  //   },
  //   promptsI18n: {
  //     'en-US': [
  //       'Convert report.pdf to a PowerPoint presentation',
  //       'Extract all charts and diagrams from whitepaper.pdf',
  //       'Transform this PDF document into slides with proper formatting',
  //     ],
  //     'zh-TW': [
  //       '将 report.pdf 转换为 PowerPoint 演示文稿',
  //       '从白皮书提取所有图表和示意图',
  //       '将此 PDF 文档转换为格式正确的幻灯片',
  //     ],
  //   },
  // },
  {
    id: 'game-3d',
    avatar: 'GameHandle',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/game-3d',
    ruleFiles: {
      'en-US': 'game-3d.md',
    },
    defaultEnabledSkills: [],
    nameI18n: {
      'en-US': '3D Game',
    },
    descriptionI18n: {
      'en-US': 'Generate a complete 3D platform collection game in one HTML file.',
    },
    promptsI18n: {
      'en-US': [
        'Create a 3D platformer game with jumping mechanics',
        'Make a coin collection game with obstacles',
        'Build a 3D maze exploration game',
      ],
    },
  },
  {
    id: 'ui-ux-pro-max',
    avatar: 'GraphicDesign',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/ui-ux-pro-max',
    ruleFiles: {
      'en-US': 'ui-ux-pro-max.md',
    },
    defaultEnabledSkills: [],
    nameI18n: {
      'en-US': 'UI/UX Pro Max',
    },
    descriptionI18n: {
      'en-US':
        'Professional UI/UX design intelligence with 57 styles, 95 color palettes, 56 font pairings, and stack-specific best practices.',
    },
    promptsI18n: {
      'en-US': [
        'Design a modern login page for a fintech mobile app',
        'Create a color palette for a nature-themed website',
        'Design a dashboard interface for a SaaS product',
      ],
    },
  },
  {
    id: 'planning-with-files',
    avatar: 'Plan',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/planning-with-files',
    ruleFiles: {
      'en-US': 'planning-with-files.md',
    },
    defaultEnabledSkills: [],
    nameI18n: {
      'en-US': 'Planning with Files',
    },
    descriptionI18n: {
      'en-US':
        'Manus-style file-based planning for complex tasks. Uses task_plan.md, findings.md, and progress.md to maintain persistent context.',
    },
    promptsI18n: {
      'en-US': [
        'Plan a comprehensive refactoring task with milestones',
        'Break down the feature implementation into actionable steps',
        'Create a project plan for migrating to a new framework',
      ],
    },
  },
  {
    id: 'human-3-coach',
    avatar: 'Compass',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/human-3-coach',
    ruleFiles: {
      'en-US': 'human-3-coach.md',
    },
    defaultEnabledSkills: [],
    nameI18n: {
      'en-US': 'HUMAN 3.0 Coach',
    },
    descriptionI18n: {
      'en-US':
        'Personal development coach based on HUMAN 3.0 framework: 4 Quadrants (Mind/Body/Spirit/Vocation), 3 Levels, 3 Growth Phases.',
    },
    promptsI18n: {
      'en-US': [
        'Help me set quarterly goals across all life quadrants',
        'Reflect on my career progress and plan next steps',
        'Create a personal development plan for the next 3 months',
      ],
    },
  },
  {
    id: 'social-job-publisher',
    avatar: 'Speaker',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/social-job-publisher',
    ruleFiles: {
      'en-US': 'social-job-publisher.md',
    },
    skillFiles: {
      'en-US': 'social-job-publisher-skills.md',
    },
    defaultEnabledSkills: [],
    nameI18n: {
      'en-US': 'Social Job Publisher',
    },
    descriptionI18n: {
      'en-US': 'Expand hiring requests into a full JD, images, and publish to social platforms via connectors.',
    },
    promptsI18n: {
      'en-US': [
        'Create a comprehensive job post for Senior Full-Stack Engineer',
        'Draft an engaging hiring tweet for social media',
        'Create a multi-platform job posting (LinkedIn, X, Redbook)',
      ],
    },
  },
  {
    id: 'moltbook',
    avatar: 'Book',
    enabled: false,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/moltbook',
    ruleFiles: {
      'en-US': 'moltbook.md',
    },
    skillFiles: {
      'en-US': 'moltbook-skills.md',
    },
    defaultEnabledSkills: [],
    nameI18n: {
      'en-US': 'moltbook',
    },
    descriptionI18n: {
      'en-US': 'The social network for AI agents. Post, comment, upvote, and create communities.',
    },
    promptsI18n: {
      'en-US': [
        'Check my moltbook feed for latest updates',
        'Post an interesting update to moltbook',
        'Check for new direct messages',
      ],
    },
  },
  {
    id: 'beautiful-mermaid',
    avatar: 'ChartLine',
    enabled: true,
    presetAgentType: 'forjinnrs',
    resourceDir: 'src/process/resources/assistant/beautiful-mermaid',
    ruleFiles: {
      'en-US': 'beautiful-mermaid.md',
    },
    defaultEnabledSkills: ['mermaid'],
    nameI18n: {
      'en-US': 'Beautiful Mermaid',
    },
    descriptionI18n: {
      'en-US':
        'Create flowcharts, sequence diagrams, state diagrams, class diagrams, and ER diagrams with beautiful themes.',
    },
    promptsI18n: {
      'en-US': [
        'Draw a detailed user login authentication flowchart',
        'Create an API sequence diagram for payment processing',
        'Create a system architecture diagram',
      ],
    },
  },
];
