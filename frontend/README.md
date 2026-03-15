# Orchestrator AI

AI-powered workflow orchestrator that generates technical, executable business workflows using OpenAI's GPT-4o. Create, edit, and manage complex multi-agent workflows with an intuitive visual interface.

## ✨ Features

### Core Capabilities
- **🤖 AI Workflow Generation**: Describe a business use case and get a detailed, technical workflow
- **📊 Visual Flow**: Interactive visualization of workflow steps with gradient connectors
- **📈 Analytics Dashboard**: Insights into workflow structure and agent distribution
- **💾 JSON Export**: Export workflows as structured JSON

### Advanced Features
- **✏️ Workflow Editing**: Add, edit, and delete workflow steps in real-time
- **🎯 Agent Library**: Choose from 16 specialized AI agents across 6 categories
  - Content (GPT-4, Claude)
  - Design (Figma, Canva)
  - Automation (Calendly, Zapier)
  - Analytics (Hotjar, Google Analytics)
  - CRM (Salesforce, HubSpot)
  - Outreach (SendGrid, Mailchimp, Web Scrapers)
- **📚 Template Management**: Save, load, and clone workflow templates
- **🎨 Enhanced Visuals**: Color-coded agents, timing icons, and smooth animations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- OpenAI API key

### Installation

1. Clone the repository
   ```bash
   git clone <your-repo-url>
   cd orchestrator-ai
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your OpenAI API key
   ```bash
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Run the development server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📖 Usage Guide

### Generating a Workflow

1. Enter a business use case in the text area (e.g., "Automate newsletter distribution with content creation, design, CRM integration, and analytics")
2. Click "Generate Workflow"
3. View the generated workflow in the Visual Flow tab

### Editing Workflows

1. Click "Edit Mode" in the header
2. Use the edit (pencil) icon to modify existing steps
3. Use the delete (trash) icon to remove steps
4. Click "Add Step" to create new workflow steps
5. Select agents from the library for each step
6. Click "Save as Template" to save your workflow

### Managing Templates

1. Click "Templates" in the header
2. Browse saved templates in the left panel
3. Click a template to preview it
4. Use "Load Template" to use it or "Clone" to create a copy

## 🌐 Deployment on Netlify

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Configure environment variables in Netlify:
   - `VITE_OPENAI_API_KEY`: Your OpenAI API key
4. Deploy!

Netlify will automatically use the `netlify.toml` configuration.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI**: OpenAI API (GPT-4o)
- **Visualization**: Recharts
- **Icons**: Lucide React
- **Styling**: Tailwind CSS (via inline styles)

## 📁 Project Structure

```
orchestrator-ai/
├── components/
│   ├── WorkflowVisualizer.tsx    # Main workflow display
│   ├── AnalyticsDashboard.tsx    # Analytics view
│   ├── StepEditor.tsx            # Step editing modal
│   └── TemplateLibrary.tsx       # Template management
├── services/
│   ├── aiService.ts              # OpenAI integration
│   └── templateService.ts        # Template CRUD operations
├── data/
│   └── agentLibrary.ts           # Agent definitions
├── types.ts                       # TypeScript interfaces
└── App.tsx                        # Main application
```

## 🔒 Security Note

⚠️ **Important**: This is a client-side application, which means the OpenAI API key is exposed in the browser. For production use, consider implementing a backend API to protect your API key.

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues or questions, please open an issue on GitHub.
