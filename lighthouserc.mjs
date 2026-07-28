/** @type {import('@lhci/cli').LighthouseRcConfig} */
export default {
  ci: {
    collect: {
      staticDistDir: './dist',
      // Key pages to audit — covers both calculators + landing + guides
      url: [
        '/',
        '/deconstruction/',
        '/expected-value/',
        '/guides/',
        '/methodology/',
      ],
      numberOfRuns: 3,
    },
    assert: {
      // Minimum thresholds — warn but don't block deploys on marginal scores
      assertions: {
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['warn', { minScore: 0.85 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
