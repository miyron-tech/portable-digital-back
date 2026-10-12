import {
  BillingPeriod,
  PricingModel,
  ServiceCategory,
} from '../services/schemas/service.schema';

export const SERVICES_SEED = [
  {
    title: 'Web application development',
    slug: 'web-development',
    summary:
      'A production-ready web application or MVP on React, Next.js and Node.js, sized to launch fast and extend from there.',
    description:
      'A focused build for a first release: a clickable prototype, a lean design pass, a React 19 and Next.js front end with a NestJS API, and a working deployment. Optional milestones add third-party integrations or extra pages if the scope grows. Bigger builds continue on the hourly track, or as a separate custom development request if the shape of the work is not one of our packages.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 490000,
    currency: 'EUR',
    deliveryTime: 'from 3 weeks',
    pricing: [
      {
        model: PricingModel.FIXED,
        amount: 490000,
        minUnits: 1,
        maxUnits: 1,
        label: 'Scoped MVP',
        milestones: [
          { key: 'mvp-build', title: 'MVP build: front end and API', amount: 490000, required: true },
          { key: 'design-pass', title: 'UI design pass', amount: 150000 },
          { key: 'integrations', title: 'Third-party integrations', amount: 180000 },
          { key: 'extra-page', title: 'Additional page or flow', amount: 90000 },
        ],
      },
      {
        model: PricingModel.HOURLY,
        amount: 4500,
        minUnits: 8,
        label: 'Team by the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'React 19 and Next.js front end',
      'NestJS API',
      'Deployment pipeline included',
      'Optional milestones for integrations and extra pages',
    ],
    tags: ['react', 'nextjs', 'nestjs', 'mvp'],
    icon: 'âï¸',
    featured: true,
    order: 1,
    seo: {
      metaTitle: 'Web application and MVP development',
      metaDescription:
        'MVP and web application development on React 19, Next.js and NestJS, from a scoped fixed price with optional milestones.',
      keywords: ['web application development', 'mvp development', 'next.js agency'],
    },
  },

  {
    title: 'Mobile development',
    slug: 'mobile-development',
    summary:
      'A single-platform mobile MVP on React Native, with the second platform and store launch support as add-ons.',
    description:
      'We build a first mobile release for iOS or Android from a shared React Native codebase. The second platform, push notifications with offline mode, and store submission support are optional milestones you add when you need them.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 590000,
    currency: 'EUR',
    deliveryTime: 'from 4 weeks',
    pricing: [
      {
        model: PricingModel.FIXED,
        amount: 590000,
        minUnits: 1,
        maxUnits: 1,
        label: 'Scoped MVP',
        milestones: [
          { key: 'mvp-build', title: 'Single-platform MVP (iOS or Android)', amount: 590000, required: true },
          { key: 'second-platform', title: 'Second platform build', amount: 250000 },
          { key: 'push-offline', title: 'Push notifications and offline mode', amount: 90000 },
          { key: 'store-launch', title: 'Store submission and launch support', amount: 60000 },
        ],
      },
      {
        model: PricingModel.HOURLY,
        amount: 4900,
        minUnits: 8,
        label: 'Team by the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'React Native codebase',
      'Optional push notifications and offline mode',
      'Second platform as an add-on',
      'Store submission support',
    ],
    tags: ['react-native', 'ios', 'android', 'mvp'],
    icon: 'ð±',
    featured: true,
    order: 2,
    seo: {
      metaTitle: 'Mobile app MVP development for iOS and Android',
      metaDescription:
        'React Native mobile MVP for a single platform, with the second platform and store launch as optional milestones.',
      keywords: ['mobile development', 'react native', 'mobile mvp'],
    },
  },

  {
    title: 'UX/UI design and design systems',
    slug: 'ux-ui-design',
    summary:
      'User research, interface design and a small design system in Figma, scoped to a single product or feature.',
    description:
      'We run a focused UX audit and map the key user flows, then design a UI kit with tokens and the core screens. The result hands off cleanly to engineering, with an optional milestone for additional screens and states.',
    category: ServiceCategory.DESIGN,
    priceFrom: 120000,
    currency: 'EUR',
    deliveryTime: 'from 2 weeks',
    pricing: [
      {
        model: PricingModel.FIXED,
        amount: 120000,
        minUnits: 1,
        maxUnits: 1,
        label: 'Scoped project',
        milestones: [
          { key: 'ux-audit', title: 'UX audit and key user flows', amount: 120000, required: true },
          { key: 'ui-kit', title: 'UI kit and design tokens', amount: 140000 },
          { key: 'screens', title: 'Additional screens and states', amount: 150000 },
        ],
      },
      {
        model: PricingModel.HOURLY,
        amount: 5500,
        minUnits: 4,
        label: 'Designer by the hour',
        tiers: [
          { minHours: 20, discountPercent: 5 },
          { minHours: 60, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'UX audit and key user flows',
      'UI kit with design tokens',
      'Handover-ready Figma files',
      'Optional milestone for extra screens',
    ],
    tags: ['ux', 'ui', 'figma', 'design-system'],
    icon: 'ð¨',
    featured: true,
    order: 3,
    seo: {
      metaTitle: 'UX/UI interface design and design systems',
      metaDescription:
        'Scoped UX/UI design: research, a Figma UI kit with tokens and the core screens, handed off ready for engineering.',
      keywords: ['ux ui design', 'interface design', 'design system'],
    },
  },

  {
    title: 'DevOps and cloud infrastructure',
    slug: 'devops-cloud',
    summary:
      'Infrastructure as code, CI/CD pipelines and a cloud setup audit, sized for a single project or service.',
    description:
      'We audit your current infrastructure, move it into Terraform code, and set up CI/CD pipelines on the provider of your choice. An optional monthly retainer keeps the setup maintained after launch. This retainer is a one-off purchase of the selected number of months; it does not renew automatically.',
    category: ServiceCategory.INFRASTRUCTURE,
    priceFrom: 149000,
    currency: 'EUR',
    deliveryTime: 'from 2 weeks',
    pricing: [
      {
        model: PricingModel.FIXED,
        amount: 149000,
        minUnits: 1,
        maxUnits: 1,
        label: 'Scoped setup',
        milestones: [
          { key: 'audit', title: 'Infrastructure audit and roadmap', amount: 149000, required: true },
          { key: 'iac', title: 'Infrastructure as code', amount: 220000 },
          { key: 'cicd', title: 'CI/CD pipeline', amount: 180000 },
        ],
      },
      {
        model: PricingModel.HOURLY,
        amount: 4900,
        minUnits: 8,
        label: 'Engineer by the hour',
        tiers: [
          { minHours: 40, discountPercent: 8 },
          { minHours: 100, discountPercent: 14 },
        ],
      },
      {
        model: PricingModel.RETAINER,
        amount: 69000,
        includedHours: 10,
        overageAmount: 6500,
        period: BillingPeriod.MONTH,
        minUnits: 1,
        maxUnits: 12,
        label: '10 hours a month, sold up to 12 months at a time, one-off, no auto-renewal',
        tiers: [
          { minHours: 10, discountPercent: 5 },
        ],
      },
    ],
    features: [
      'Infrastructure audit and roadmap',
      'Infrastructure as code with Terraform',
      'CI/CD pipeline setup',
      'Optional monthly maintenance retainer',
    ],
    tags: ['devops', 'kubernetes', 'terraform', 'ci-cd'],
    icon: 'âï¸',
    featured: true,
    order: 4,
    seo: {
      metaTitle: 'DevOps services and cloud infrastructure setup',
      metaDescription:
        'Infrastructure audit, Terraform infrastructure-as-code and CI/CD pipeline setup, with an optional monthly retainer.',
      keywords: ['devops services', 'infrastructure as code', 'cloud infrastructure setup'],
    },
  },

  {
    title: 'Data analytics and BI',
    slug: 'data-analytics-bi',
    summary:
      'A data model, ETL pipelines and BI dashboards for a single reporting or analytics need.',
    description:
      'We design a data model for the problem at hand, build the ETL pipelines that feed it, and connect BI dashboards your team will actually use. Scope grows through optional milestones as new data sources come in.',
    category: ServiceCategory.DATA,
    priceFrom: 240000,
    currency: 'EUR',
    deliveryTime: 'from 3 weeks',
    pricing: [
      {
        model: PricingModel.FIXED,
        amount: 240000,
        minUnits: 1,
        maxUnits: 1,
        label: 'Scoped project',
        milestones: [
          { key: 'data-model', title: 'Data model and warehouse design', amount: 240000, required: true },
          { key: 'etl', title: 'ETL/ELT pipelines', amount: 260000 },
          { key: 'dashboards', title: 'BI dashboards', amount: 220000 },
        ],
      },
      {
        model: PricingModel.HOURLY,
        amount: 5900,
        minUnits: 8,
        label: 'Analyst by the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 11 },
        ],
      },
    ],
    features: [
      'Data model and warehouse design',
      'ETL/ELT pipelines',
      'BI dashboards',
      'Optional milestone for extra data sources',
    ],
    tags: ['data', 'bi', 'etl'],
    icon: 'ð',
    featured: false,
    order: 5,
    seo: {
      metaTitle: 'Data analytics and BI implementation',
      metaDescription:
        'A scoped data model, ETL pipelines and BI dashboards, priced as a fixed project with an hourly track for more.',
      keywords: ['data analytics', 'bi implementation', 'etl development'],
    },
  },

  {
    title: 'Monitoring and observability',
    slug: 'monitoring-observability',
    summary:
      'Metrics, logs and alerts set up for a single service, with an optional monthly retainer to keep it maintained.',
    description:
      'We set up a metrics and log baseline for your service, build dashboards that show the cause of an incident rather than just the fact of it, and configure alerting so pages fire for real incidents. An optional monthly retainer covers ongoing tuning; it is a one-off purchase of the selected number of months and does not renew automatically.',
    category: ServiceCategory.MONITORING,
    priceFrom: 89000,
    currency: 'EUR',
    deliveryTime: 'from 2 weeks',
    pricing: [
      {
        model: PricingModel.FIXED,
        amount: 89000,
        minUnits: 1,
        maxUnits: 1,
        label: 'Scoped setup',
        milestones: [
          { key: 'baseline', title: 'Metrics and log baseline', amount: 89000, required: true },
          { key: 'dashboards', title: 'Dashboards', amount: 90000 },
          { key: 'alerting', title: 'Alerting and on-call rota setup', amount: 110000 },
        ],
      },
      {
        model: PricingModel.RETAINER,
        amount: 39000,
        includedHours: 6,
        overageAmount: 5900,
        period: BillingPeriod.MONTH,
        minUnits: 1,
        maxUnits: 12,
        label: '6 hours a month, sold up to 12 months at a time, one-off, no auto-renewal',
      },
    ],
    features: [
      'Metrics and log baseline',
      'Dashboards for the service',
      'Alerting configuration',
      'Optional monthly retainer for upkeep',
    ],
    tags: ['monitoring', 'observability', 'prometheus', 'grafana'],
    icon: 'ð¡',
    featured: false,
    order: 6,
    seo: {
      metaTitle: 'Monitoring and observability setup',
      metaDescription:
        'Metrics, log and alerting setup for a single service, with a written dashboard and an optional upkeep retainer.',
      keywords: ['infrastructure monitoring', 'observability setup', 'alerting setup'],
    },
  },

  {
    title: 'Technical support and SLA',
    slug: 'support-sla',
    summary:
      'A monthly support retainer with included hours, an SLA response time, and 24/7 monitoring of your systems.',
    description:
      'We take an existing system into support: monitoring runs 24/7, incidents are triaged against an SLA, and included hours cover routine fixes. Extra hours beyond the plan are billed at the overage rate; hourly incident response without a plan is also available. This retainer is a one-off purchase of the selected number of months; it does not renew automatically.',
    category: ServiceCategory.SUPPORT,
    priceFrom: 49000,
    currency: 'EUR',
    deliveryTime: 'onboarding in 3 business days',
    pricing: [
      {
        model: PricingModel.RETAINER,
        amount: 49000,
        includedHours: 8,
        overageAmount: 5500,
        period: BillingPeriod.MONTH,
        minUnits: 1,
        maxUnits: 12,
        label: 'SLA plan, 8 hours a month included, sold up to 12 months at a time, no auto-renewal',
        tiers: [
          { minHours: 10, discountPercent: 5 },
        ],
      },
      {
        model: PricingModel.HOURLY,
        amount: 5500,
        minUnits: 1,
        label: 'Incident response, no plan',
      },
    ],
    features: [
      '24/7 monitoring',
      'SLA with a committed response time',
      'Included hours each period',
      'Hourly incident response without a plan',
    ],
    tags: ['support', 'sla', 'monitoring'],
    icon: 'ð ï¸',
    featured: false,
    order: 7,
    seo: {
      metaTitle: 'Technical support for IT systems with an SLA',
      metaDescription:
        'Monthly support retainer with included hours, a committed SLA response time and 24/7 monitoring.',
      keywords: ['technical support', 'sla support', 'on-call retainer'],
    },
  },

  {
    title: 'Integrations and API platforms',
    slug: 'integrations-api',
    summary:
      'A single API integration â payment gateway, CRM, ERP or another external system â designed and documented.',
    description:
      'We write the integration spec, build the connectors, and hand over OpenAPI documentation so a new consumer can onboard quickly. Delivery continues on the hourly or mixed track if the integration grows in scope.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 79000,
    currency: 'EUR',
    deliveryTime: 'from 2 weeks',
    pricing: [
      {
        model: PricingModel.FIXED,
        amount: 79000,
        minUnits: 1,
        maxUnits: 1,
        label: 'Scoped project',
        milestones: [
          { key: 'spec', title: 'Integration specification', amount: 79000, required: true },
          { key: 'connectors', title: 'Connectors build', amount: 140000 },
          { key: 'handover', title: 'Docs and handover', amount: 90000 },
        ],
      },
      {
        model: PricingModel.HOURLY,
        amount: 4500,
        minUnits: 8,
        label: 'Engineer by the hour',
        tiers: [
          { minHours: 40, discountPercent: 6 },
          { minHours: 100, discountPercent: 12 },
        ],
      },
    ],
    features: [
      'Integration specification',
      'Connector build',
      'OpenAPI documentation',
      'Hourly track for ongoing work',
    ],
    tags: ['api', 'integrations'],
    icon: 'ð',
    featured: false,
    order: 8,
    seo: {
      metaTitle: 'API integration development',
      metaDescription:
        'A single API integration, spec to handover, with OpenAPI documentation and an hourly track for growing scope.',
      keywords: ['api integration', 'system integration', 'openapi development'],
    },
  },

  /*
   * Почасовые услуги: отдельные задачи, а не команда на полный цикл. Ставки
   * держим в рыночной вилке 20–40 € в час, поэтому и часовые тарифы услуг
   * выше приведены к ней же — одна и та же работа не может стоить по-разному.
   */
  {
    title: 'Frontend development',
    slug: 'frontend-development',
    summary:
      'React and Next.js work by the hour: new screens, a shared component library and the performance fixes that follow.',
    description:
      'A front-end engineer joins your project and works through your backlog: interfaces on React 19 and Next.js, reusable components, responsive layout, accessibility and Core Web Vitals. Everything lands in your own repository as reviewed pull requests.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 3400,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3400,
        minUnits: 8,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
          { minHours: 250, discountPercent: 15 },
        ],
      },
    ],
    features: [
      'React 19 and Next.js, in your repository',
      'Reusable components and design tokens',
      'Responsive layout down to 320px',
      'Reviewed pull requests, not a black box',
    ],
    tags: ['react', 'nextjs', 'frontend', 'typescript'],
    icon: '🧩',
    featured: false,
    order: 9,
    seo: {
      metaTitle: 'Frontend development by the hour — React and Next.js',
      metaDescription:
        'Hire a React and Next.js engineer by the hour: screens, components, responsive layout and Core Web Vitals.',
      keywords: ['hire react developer', 'frontend development hourly', 'next.js developer'],
    },
  },
  {
    title: 'Backend development',
    slug: 'backend-development',
    summary:
      'Node.js and NestJS engineering by the hour: endpoints, business logic, database work and migrations.',
    description:
      'An engineer picks up your API: new endpoints on NestJS, data models in PostgreSQL or MongoDB, queues and background jobs, safe migrations and tests. Work arrives through code review in your repository.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 3600,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3600,
        minUnits: 8,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
          { minHours: 250, discountPercent: 15 },
        ],
      },
    ],
    features: [
      'REST or GraphQL on NestJS',
      'Schema design and safe migrations',
      'Queues, jobs and third-party APIs',
      'Unit and integration tests',
    ],
    tags: ['nodejs', 'nestjs', 'api', 'backend'],
    icon: '🛠️',
    featured: false,
    order: 10,
    seo: {
      metaTitle: 'Backend development by the hour — Node.js and NestJS',
      metaDescription:
        'Hire a Node.js and NestJS engineer by the hour: endpoints, data models, queues, migrations and tests.',
      keywords: ['hire node js developer', 'nestjs development', 'backend development hourly'],
    },
  },
  {
    title: 'Mobile feature work',
    slug: 'mobile-feature-work',
    summary:
      'React Native development by the hour: new screens, native modules and store releases for an app you already have.',
    description:
      'For a live application that needs to keep moving: features from your backlog, native modules where the SDK falls short, push notifications and deep links, plus the builds and store submissions that go with them.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 3800,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3800,
        minUnits: 8,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
          { minHours: 250, discountPercent: 15 },
        ],
      },
    ],
    features: [
      'One codebase for iOS and Android',
      'Native modules when the SDK is not enough',
      'Push notifications and deep links',
      'Builds and store submissions',
    ],
    tags: ['react native', 'ios', 'android', 'mobile'],
    icon: '📱',
    featured: false,
    order: 11,
    seo: {
      metaTitle: 'React Native development by the hour',
      metaDescription:
        'Hourly React Native work on a live app: features, native modules, push notifications and store releases.',
      keywords: ['react native developer hourly', 'mobile app maintenance', 'ios android development'],
    },
  },
  {
    title: 'WordPress and CMS work',
    slug: 'wordpress-cms',
    summary:
      'WordPress, Strapi and headless CMS work: templates, blocks, plugins and the edits your editors keep asking for.',
    description:
      'Everything around a content site: custom themes and blocks, plugin fixes, careful updates, and headless setups where the CMS feeds a Next.js front end. Your editors get a short handover so they can keep going on their own.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 2400,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2400,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Custom themes, blocks and templates',
      'Plugin fixes and safe updates',
      'Headless setups with a Next.js front end',
      'Handover notes for your editors',
    ],
    tags: ['wordpress', 'cms', 'strapi', 'headless'],
    icon: '📝',
    featured: false,
    order: 12,
    seo: {
      metaTitle: 'WordPress and CMS development by the hour',
      metaDescription:
        'Hourly WordPress, Strapi and headless CMS work: themes, blocks, plugins, updates and headless front ends.',
      keywords: ['wordpress developer hourly', 'headless cms development', 'strapi developer'],
    },
  },
  {
    title: 'Bug fixing and small changes',
    slug: 'bug-fixing',
    summary:
      'Small, exact fixes by the hour: a broken form, a failing build, a layout that fell apart after an update.',
    description:
      'Send the symptom. We reproduce it, find the cause, ship the fix and write down what happened. No discovery phase and no multi-day minimum — a two-hour block is enough for most single issues, and legacy code is welcome.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 2800,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2800,
        minUnits: 2,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Two-hour minimum, no discovery phase',
      'Reproduced before anything is changed',
      'A short note on the root cause',
      'Legacy code is welcome',
    ],
    tags: ['bugfix', 'hotfix', 'maintenance'],
    icon: '🩹',
    featured: false,
    order: 13,
    seo: {
      metaTitle: 'Bug fixing by the hour',
      metaDescription:
        'Hourly bug fixing for web and mobile products: reproduction, root cause and a documented fix from two hours.',
      keywords: ['hire developer to fix bug', 'hourly bug fixing', 'website hotfix'],
    },
  },
  {
    title: 'Manual QA testing',
    slug: 'manual-qa-testing',
    summary:
      'A tester walks through your product by hand: functional passes, regression before a release and reports you can act on.',
    description:
      'Hands-on testing without building a QA department: checklists written for your product, a regression pass before each release, and bug reports with steps, video and logs. Desktop, mobile and the browsers your analytics actually show.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 2200,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2200,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Test cases and checklists you keep',
      'Regression pass before each release',
      'Reports with steps, video and logs',
      'Desktop, mobile and cross-browser',
    ],
    tags: ['qa', 'testing', 'regression'],
    icon: '🔍',
    featured: false,
    order: 14,
    seo: {
      metaTitle: 'Manual QA testing by the hour',
      metaDescription:
        'Hourly manual testing: functional passes, release regression and bug reports with steps, video and logs.',
      keywords: ['manual qa hourly', 'software testing services', 'regression testing'],
    },
  },
  {
    title: 'Test automation',
    slug: 'test-automation',
    summary:
      'Playwright and Jest suites by the hour, wired into your CI so releases stop breaking quietly.',
    description:
      'We cover the paths that cost money when they break: end-to-end scenarios on Playwright, unit and API tests on Jest, all running on every pull request. Flaky tests get diagnosed rather than switched off.',
    category: ServiceCategory.DEVELOPMENT,
    priceFrom: 3000,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3000,
        minUnits: 8,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
          { minHours: 250, discountPercent: 15 },
        ],
      },
    ],
    features: [
      'End-to-end suites on Playwright',
      'Unit and API tests on Jest',
      'Runs on every pull request',
      'Flaky tests triaged, not muted',
    ],
    tags: ['playwright', 'jest', 'ci', 'automation'],
    icon: '🤖',
    featured: false,
    order: 15,
    seo: {
      metaTitle: 'Test automation by the hour — Playwright and Jest',
      metaDescription:
        'Hourly test automation: Playwright end-to-end suites, Jest unit and API tests, running in your CI.',
      keywords: ['playwright automation', 'test automation services', 'ci testing'],
    },
  },
  {
    title: 'UI design for screens',
    slug: 'ui-screen-design',
    summary:
      'Interface design by the hour: new screens, states and components that fit the design system you already have.',
    description:
      'For teams that need design in small, regular portions. Screens drawn in Figma with every state — empty, loading, error — components kept in sync with your tokens, and handoff notes developers can build from without a meeting.',
    category: ServiceCategory.DESIGN,
    priceFrom: 2800,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2800,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Figma files with components and variants',
      'Every state: empty, loading, error',
      'Handoff notes developers can build from',
      'Design tokens kept in sync',
    ],
    tags: ['figma', 'ui', 'design system'],
    icon: '🎨',
    featured: false,
    order: 16,
    seo: {
      metaTitle: 'UI design by the hour',
      metaDescription:
        'Hourly UI design in Figma: screens, states, components and handoff notes that fit your design system.',
      keywords: ['hourly ui design', 'figma designer hourly', 'design system support'],
    },
  },
  {
    title: 'Landing page design',
    slug: 'landing-page-design',
    summary:
      'A single page designed around one action: structure, content blocks, visuals and a mobile version.',
    description:
      'One page, done properly: a structure built around the action you want, content blocks written to carry it, visuals prepared for the build and a mobile version in the same pass. Two rounds of revisions are part of the work.',
    category: ServiceCategory.DESIGN,
    priceFrom: 2600,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2600,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Structure built around one action',
      'Desktop and mobile in one pass',
      'Assets exported and ready to build',
      'Two rounds of revisions included',
    ],
    tags: ['landing', 'figma', 'conversion'],
    icon: '🖼️',
    featured: false,
    order: 17,
    seo: {
      metaTitle: 'Landing page design by the hour',
      metaDescription:
        'Hourly landing page design: structure, content blocks, visuals, mobile version and two rounds of revisions.',
      keywords: ['landing page design', 'figma landing design', 'conversion page design'],
    },
  },
  {
    title: 'Graphics and brand assets',
    slug: 'brand-graphics',
    summary:
      'Banners, social cards, presentation slides and icon sets, drawn to match the identity you already use.',
    description:
      'The steady stream of visual pieces a live brand needs: ad and social formats in every size, pitch and report slides, icon sets in SVG. Source files are handed over, so nothing is locked inside our account.',
    category: ServiceCategory.DESIGN,
    priceFrom: 2200,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2200,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Banners, social and ad formats',
      'Presentation and pitch slides',
      'Icon sets in SVG',
      'Source files handed over',
    ],
    tags: ['branding', 'graphics', 'svg'],
    icon: '✏️',
    featured: false,
    order: 18,
    seo: {
      metaTitle: 'Graphic and brand assets by the hour',
      metaDescription:
        'Hourly graphic design: banners, social cards, presentation slides and SVG icon sets in your existing identity.',
      keywords: ['hourly graphic design', 'social media banners', 'presentation design'],
    },
  },
  {
    title: 'DevOps and CI/CD by the hour',
    slug: 'devops-hourly',
    summary:
      'Pipelines, containers and deploys by the hour: a release that runs on a push instead of by hand.',
    description:
      'A focused piece of infrastructure work, not a transformation programme: a pipeline in GitHub Actions or GitLab CI, Docker images and compose files, a deploy that waits for health checks and rolls back on its own, and secrets kept out of the repository.',
    category: ServiceCategory.INFRASTRUCTURE,
    priceFrom: 4000,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 4000,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
          { minHours: 250, discountPercent: 15 },
        ],
      },
    ],
    features: [
      'GitHub Actions or GitLab CI pipelines',
      'Docker images and compose setups',
      'Deploys with health checks and rollback',
      'Secrets kept out of the repository',
    ],
    tags: ['devops', 'docker', 'ci/cd', 'github actions'],
    icon: '🚀',
    featured: false,
    order: 19,
    seo: {
      metaTitle: 'DevOps and CI/CD by the hour',
      metaDescription:
        'Hourly DevOps work: GitHub Actions pipelines, Docker, automated deploys with health checks and rollback.',
      keywords: ['devops hourly rate', 'ci cd setup', 'docker deployment'],
    },
  },
  {
    title: 'Linux server administration',
    slug: 'server-administration',
    summary:
      'Server work by the hour: setup, hardening, backups, certificates and the migration you keep postponing.',
    description:
      'Day-to-day work on the machines your product runs on: Nginx or Caddy with TLS and domains, backups with a restore that has actually been tested, firewall and SSH hardening, and moves between hosts done outside business hours.',
    category: ServiceCategory.INFRASTRUCTURE,
    priceFrom: 3000,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3000,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Nginx or Caddy, TLS and domains',
      'Backups with a tested restore',
      'Hardening: firewall, SSH, updates',
      'Migration between hosts and providers',
    ],
    tags: ['linux', 'nginx', 'backup', 'ssh'],
    icon: '🖥️',
    featured: false,
    order: 20,
    seo: {
      metaTitle: 'Linux server administration by the hour',
      metaDescription:
        'Hourly server administration: Nginx and Caddy, TLS, backups with tested restores, hardening and migrations.',
      keywords: ['linux admin hourly', 'server administration services', 'server migration'],
    },
  },
  {
    title: 'Data engineering and ETL',
    slug: 'data-engineering',
    summary:
      'Pipelines that move your data: extraction, cleaning, scheduling and the storage underneath.',
    description:
      'We connect the sources you already pay for and turn them into tables people can query: jobs on Airflow or cron, a warehouse schema in PostgreSQL or ClickHouse, quality checks that raise an alert instead of failing quietly, and jobs you can re-run without fear.',
    category: ServiceCategory.DATA,
    priceFrom: 3800,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3800,
        minUnits: 8,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
          { minHours: 250, discountPercent: 15 },
        ],
      },
    ],
    features: [
      'Pipelines on Airflow or cron',
      'Warehouse schemas in PostgreSQL or ClickHouse',
      'Data quality checks with alerts',
      'Documented, re-runnable jobs',
    ],
    tags: ['etl', 'airflow', 'sql', 'warehouse'],
    icon: '🧮',
    featured: false,
    order: 21,
    seo: {
      metaTitle: 'Data engineering and ETL by the hour',
      metaDescription:
        'Hourly data engineering: ETL pipelines on Airflow, warehouse schemas, quality checks and re-runnable jobs.',
      keywords: ['etl development', 'data engineer hourly', 'data pipeline services'],
    },
  },
  {
    title: 'Dashboards and BI reports',
    slug: 'bi-dashboards',
    summary:
      'Metrics in one place: dashboards in Metabase, Grafana or Power BI, built on the data you already hold.',
    description:
      'Numbers your team can act on: metric definitions agreed before anything is drawn, dashboards with filters people actually use, scheduled reports into email or chat, and SQL left readable so your analysts can change it later.',
    category: ServiceCategory.DATA,
    priceFrom: 3200,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3200,
        minUnits: 8,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
          { minHours: 250, discountPercent: 15 },
        ],
      },
    ],
    features: [
      'Metric definitions agreed up front',
      'Dashboards your team can filter',
      'Scheduled reports by email or chat',
      'SQL you can read and change',
    ],
    tags: ['bi', 'metabase', 'grafana', 'sql'],
    icon: '📊',
    featured: false,
    order: 22,
    seo: {
      metaTitle: 'BI dashboards by the hour',
      metaDescription:
        'Hourly BI work: dashboards in Metabase, Grafana or Power BI, agreed metrics and scheduled reports.',
      keywords: ['bi dashboard development', 'metabase consultant', 'reporting dashboards'],
    },
  },
  {
    title: 'Monitoring setup',
    slug: 'monitoring-setup',
    summary:
      'Prometheus, Grafana and alerts configured by the hour, so an outage reaches you before your customers do.',
    description:
      'Metrics, logs and uptime checks wired into one place, a dashboard per service, and alerts that go to the channel your team reads. Thresholds are tuned after a few days of real traffic so the noise stays low enough to trust.',
    category: ServiceCategory.MONITORING,
    priceFrom: 3400,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 3400,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Metrics, logs and uptime checks',
      'A dashboard per service',
      'Alerts to Telegram, Slack or email',
      'Thresholds tuned on real traffic',
    ],
    tags: ['prometheus', 'grafana', 'alerting', 'uptime'],
    icon: '📡',
    featured: false,
    order: 23,
    seo: {
      metaTitle: 'Monitoring setup by the hour — Prometheus and Grafana',
      metaDescription:
        'Hourly monitoring work: metrics, logs, uptime checks, per-service dashboards and alerts tuned to cut noise.',
      keywords: ['prometheus setup', 'grafana dashboards', 'uptime monitoring'],
    },
  },
  {
    title: 'Technical support L1/L2',
    slug: 'technical-support',
    summary:
      'An engineer on your side of the inbox: user questions, access problems and the first look at every incident.',
    description:
      'Support hours bought in blocks and used as they are needed. We answer in your own tools, triage before anything reaches your developers, and write the runbook as we go, so the second time a problem appears it is already solved.',
    category: ServiceCategory.SUPPORT,
    priceFrom: 2000,
    currency: 'EUR',
    deliveryTime: 'start within a week',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2000,
        minUnits: 8,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Replies to users in your own tools',
      'Triage before developers are involved',
      'Runbooks written as we go',
      'Blocks of hours, used as needed',
    ],
    tags: ['support', 'helpdesk', 'sla'],
    icon: '🎧',
    featured: false,
    order: 24,
    seo: {
      metaTitle: 'Technical support L1/L2 by the hour',
      metaDescription:
        'Hourly L1 and L2 technical support: user questions, access issues, incident triage and runbooks.',
      keywords: ['outsourced technical support', 'l1 l2 support', 'helpdesk services'],
    },
  },
  {
    title: 'Website maintenance',
    slug: 'website-maintenance',
    summary:
      'Content edits, updates, backups and small improvements on a site that is already live.',
    description:
      'The quiet work that keeps a live site healthy: page and content edits, framework and plugin updates applied carefully, backups and uptime checks, and the speed or SEO fixes that surface along the way.',
    category: ServiceCategory.SUPPORT,
    priceFrom: 2500,
    currency: 'EUR',
    deliveryTime: 'start in 2 days',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 2500,
        minUnits: 4,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Content and page edits',
      'Framework and plugin updates',
      'Backups and uptime checks',
      'Speed and SEO fixes as they appear',
    ],
    tags: ['maintenance', 'updates', 'seo'],
    icon: '🧰',
    featured: false,
    order: 25,
    seo: {
      metaTitle: 'Website maintenance by the hour',
      metaDescription:
        'Hourly website maintenance: content edits, updates, backups, uptime checks and speed or SEO fixes.',
      keywords: ['website maintenance hourly', 'site support services', 'cms updates'],
    },
  },
  {
    title: 'Consulting and technical audit',
    slug: 'tech-consulting',
    summary:
      'An hour with an engineer: architecture review, code audit, a stack decision or a second opinion before you commit.',
    description:
      'Useful when the decision is bigger than the budget for it: we read the code, review the architecture, compare the options and send written findings ranked by risk. No retainer and no discovery project — two hours is a valid order.',
    category: ServiceCategory.SUPPORT,
    priceFrom: 4000,
    currency: 'EUR',
    deliveryTime: 'next business day',
    pricing: [
      {
        model: PricingModel.HOURLY,
        amount: 4000,
        minUnits: 2,
        label: 'By the hour',
        tiers: [
          { minHours: 40, discountPercent: 5 },
          { minHours: 100, discountPercent: 10 },
        ],
      },
    ],
    features: [
      'Architecture and code review',
      'Written findings, ranked by risk',
      'Stack and vendor comparison',
      'Two-hour minimum, no retainer',
    ],
    tags: ['consulting', 'audit', 'architecture'],
    icon: '🧭',
    featured: false,
    order: 26,
    seo: {
      metaTitle: 'Technical consulting and audit by the hour',
      metaDescription:
        'Hourly technical consulting: architecture review, code audit, stack comparison and written findings.',
      keywords: ['technical audit', 'architecture review', 'it consulting hourly'],
    },
  },
];
