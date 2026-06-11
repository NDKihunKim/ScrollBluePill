export type VersionTag = {
	id: string;
	labelKo: string;
	labelEn?: string;
	dataDate?: string;
	description?: string;
	isActive: boolean;
};

export type ScrollDefinition = {
	id: string;
	versionTagId: string;
	nameKo: string;
	category: string;
	behaviorType: 'fixed' | 'random' | 'chaos' | 'unknown';
	affectedStats: string[];
	statEffectFrame?: Record<string, unknown>;
	probabilitySetId?: string;
	sourceNote?: string;
};

export type ItemCategory = {
	id: string;
	versionTagId: string;
	nameKo: string;
	statGroups: string[];
	defaultSlotFrame?: Record<string, unknown>;
	sourceNote?: string;
};

export type ProbabilitySet = {
	id: string;
	versionTagId: string;
	scrollDefinitionId?: string;
	modelType: string;
	rawConfig: Record<string, unknown>;
	validationStatus: 'draft' | 'reviewed' | 'verified';
	sourceNote?: string;
};

export type GuideContent = {
	id: string;
	titleKo: string;
	slug: string;
	summaryKo: string;
	bodyFrame?: Record<string, unknown>;
	seoTitleKo: string;
	seoDescriptionKo: string;
	publishedStatus: 'draft' | 'published';
};

export type ProbabilityDistributionPoint = {
	value: number;
	probability: number;
};

export type ProbabilityResult = {
	distribution: ProbabilityDistributionPoint[];
	expectedValue: number;
	targetProbability?: number;
	percentiles: {
		p10?: number;
		p25?: number;
		p50?: number;
		p75?: number;
		p90?: number;
		p95?: number;
	};
};
