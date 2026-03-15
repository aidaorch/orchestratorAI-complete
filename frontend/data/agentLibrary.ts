export interface Agent {
    id: string;
    name: string;
    type: string;
    description: string;
    capabilities: string[];
    icon: string;
    category: 'content' | 'design' | 'automation' | 'analytics' | 'outreach';
}

export const AGENT_LIBRARY: Agent[] = [
    // Content Agents
    {
        id: 'content-gpt4',
        name: 'GPT-4 Content Generator',
        type: 'Content',
        description: 'Advanced AI content generation using GPT-4 for high-quality copywriting',
        capabilities: ['Blog posts', 'Marketing copy', 'SEO content', 'Social media'],
        icon: '✍️',
        category: 'content'
    },
    {
        id: 'content-claude',
        name: 'Claude Content Writer',
        type: 'Content',
        description: 'Long-form content creation with Claude AI for detailed articles',
        capabilities: ['Long-form articles', 'Technical writing', 'Documentation'],
        icon: '📝',
        category: 'content'
    },

    // Design Agents
    {
        id: 'design-canva',
        name: 'Canva Design Automation',
        type: 'Design',
        description: 'Automated design generation using Canva API',
        capabilities: ['Social graphics', 'Presentations', 'Infographics'],
        icon: '🎨',
        category: 'design'
    },
    {
        id: 'design-figma',
        name: 'Figma Design Agent',
        type: 'Design',
        description: 'Professional UI/UX design automation with Figma',
        capabilities: ['UI mockups', 'Prototypes', 'Design systems'],
        icon: '🖌️',
        category: 'design'
    },

    // Automation Agents
    {
        id: 'scheduler-zapier',
        name: 'Zapier Scheduler',
        type: 'Scheduler',
        description: 'Workflow scheduling and automation via Zapier',
        capabilities: ['Task scheduling', 'Workflow triggers', 'App integrations'],
        icon: '⏰',
        category: 'automation'
    },
    {
        id: 'scraper-puppeteer',
        name: 'Puppeteer Web Scraper',
        type: 'Scraper',
        description: 'Automated web scraping with browser automation',
        capabilities: ['Web scraping', 'Form filling', 'Authentication', 'Data extraction'],
        icon: '🕷️',
        category: 'automation'
    },
    {
        id: 'scraper-beautiful-soup',
        name: 'BeautifulSoup Scraper',
        type: 'Scraper',
        description: 'Python-based HTML parsing and data extraction',
        capabilities: ['HTML parsing', 'Data extraction', 'API scraping'],
        icon: '🔍',
        category: 'automation'
    },

    // Analytics Agents
    {
        id: 'analytics-google',
        name: 'Google Analytics Agent',
        type: 'Analytics',
        description: 'Data analysis and reporting using Google Analytics',
        capabilities: ['Traffic analysis', 'Conversion tracking', 'Custom reports'],
        icon: '📊',
        category: 'analytics'
    },
    {
        id: 'analytics-tableau',
        name: 'Tableau Visualization',
        type: 'Analytics',
        description: 'Advanced data visualization and dashboards',
        capabilities: ['Data visualization', 'Interactive dashboards', 'Business intelligence'],
        icon: '📈',
        category: 'analytics'
    },
    {
        id: 'heatmap-hotjar',
        name: 'Hotjar Heatmap',
        type: 'Heatmaps',
        description: 'User behavior tracking and heatmap generation',
        capabilities: ['Click tracking', 'Scroll maps', 'Session recordings'],
        icon: '🔥',
        category: 'analytics'
    },
    {
        id: 'bounce-analyzer',
        name: 'Bounce Rate Analyzer',
        type: 'Bounce',
        description: 'Analyze and reduce website bounce rates',
        capabilities: ['Bounce analysis', 'Exit intent', 'User flow tracking'],
        icon: '↩️',
        category: 'analytics'
    },
    {
        id: 'subject-line-tester',
        name: 'Subject Line Optimizer',
        type: 'Subject Line Checker',
        description: 'AI-powered email subject line testing and optimization',
        capabilities: ['A/B testing', 'Spam score', 'Open rate prediction'],
        icon: '📧',
        category: 'analytics'
    },

    // CRM & Outreach Agents
    {
        id: 'crm-hubspot',
        name: 'HubSpot CRM',
        type: 'CRM',
        description: 'Customer relationship management with HubSpot',
        capabilities: ['Contact management', 'Lead tracking', 'Pipeline management'],
        icon: '👥',
        category: 'outreach'
    },
    {
        id: 'crm-salesforce',
        name: 'Salesforce CRM',
        type: 'CRM',
        description: 'Enterprise CRM integration with Salesforce',
        capabilities: ['Enterprise CRM', 'Sales automation', 'Custom workflows'],
        icon: '💼',
        category: 'outreach'
    },
    {
        id: 'outreach-sendgrid',
        name: 'SendGrid Email Agent',
        type: 'Outreach',
        description: 'Automated email campaigns via SendGrid',
        capabilities: ['Email campaigns', 'Transactional emails', 'Analytics'],
        icon: '📨',
        category: 'outreach'
    },
    {
        id: 'outreach-mailchimp',
        name: 'Mailchimp Automation',
        type: 'Outreach',
        description: 'Marketing automation with Mailchimp',
        capabilities: ['Email marketing', 'Audience segmentation', 'Campaign automation'],
        icon: '🐵',
        category: 'outreach'
    }
];

export const getAgentsByType = (type: string): Agent[] => {
    return AGENT_LIBRARY.filter(agent => agent.type === type);
};

export const getAgentById = (id: string): Agent | undefined => {
    return AGENT_LIBRARY.find(agent => agent.id === id);
};

export const getAgentsByCategory = (category: string): Agent[] => {
    return AGENT_LIBRARY.filter(agent => agent.category === category);
};
