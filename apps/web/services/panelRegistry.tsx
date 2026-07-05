import { AIAnalysisResult, Reservoir, SeasonalData } from '../types';
import AIInsights from '../components/AIInsights';
import ModelFeedback from '../components/ModelFeedback';
import VolumeChart from '../components/VolumeChart';
import MLStatusPanel from '../components/MLStatusPanel';
import WaterSpreadPanel from '../components/WaterSpreadPanel';
import BathymetryPanel from '../components/BathymetryPanel';

export interface DashboardPanelContext {
  capabilities: Record<string, { enabled: boolean; [key: string]: any }>;
  selectedReservoir: Reservoir;
  season: SeasonalData['season'];
  historicalData: SeasonalData[];
  mlForecast: number | null;
  maxCapacity: number;
  aiAnalysis: AIAnalysisResult | null;
  hybridRisk: any;
  digitalTwin: any;
  isGeneratingReport: boolean;
  currentData: SeasonalData;
  onGenerateAI: () => void;
  onFeedbackSubmit: (feedback: any) => void;
}

export interface DashboardPanelDefinition {
  id: string;
  enabled: (ctx: DashboardPanelContext) => boolean;
  component: any;
  getProps: (ctx: DashboardPanelContext) => Record<string, any>;
}

const PANEL_REGISTRY: DashboardPanelDefinition[] = [
  {
    id: 'ai_insights',
    enabled: (ctx) => !!ctx.capabilities.hybrid_risk?.enabled || !!ctx.capabilities.digital_twin?.enabled,
    component: AIInsights,
    getProps: (ctx) => ({
      analysis: ctx.aiAnalysis,
      hybridRisk: ctx.hybridRisk,
      digitalTwin: ctx.digitalTwin,
      isLoading: ctx.isGeneratingReport,
      onGenerate: ctx.onGenerateAI,
    }),
  },
  {
    id: 'model_feedback',
    enabled: (ctx) => !!ctx.aiAnalysis,
    component: ModelFeedback,
    getProps: (ctx) => ({
      analysis: ctx.aiAnalysis,
      data: ctx.currentData,
      onFeedbackSubmit: ctx.onFeedbackSubmit,
    }),
  },
  {
    id: 'volume_chart',
    enabled: () => true,
    component: VolumeChart,
    getProps: (ctx) => ({
      data: ctx.historicalData,
      forecast: ctx.mlForecast,
      maxCapacity: ctx.maxCapacity,
    }),
  },
  {
    id: 'waterspread_detailed',
    enabled: (ctx) => !!ctx.capabilities.waterspread_detailed?.enabled,
    component: WaterSpreadPanel,
    getProps: (ctx) => ({
      reservoir: ctx.selectedReservoir,
      season: ctx.season,
    }),
  },
  {
    id: 'ml_status',
    enabled: () => true,
    component: MLStatusPanel,
    getProps: () => ({}),
  },
  {
    id: 'bathymetry_panel',
    enabled: (ctx) => !!ctx.capabilities.bathymetry_volume?.enabled,
    component: BathymetryPanel,
    getProps: () => ({}),
  },
];

export const getActivePanels = (ctx: DashboardPanelContext): DashboardPanelDefinition[] => {
  return PANEL_REGISTRY.filter((panel) => panel.enabled(ctx));
};
