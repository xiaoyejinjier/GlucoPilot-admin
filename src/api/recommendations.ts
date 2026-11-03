import { get } from '@/utils/request'

export interface RecommendationDimension {
  tagId: string; code: string; name: string
  rawWeight: number; decayedWeight: number; normalizedWeight: number
}
export interface RecommendationTag {
  tagId: string; name: string; userWeight: number; articleWeight: number; contribution: number
}
export interface RankedArticle {
  id: string; title: string; author: string; tags: RecommendationTag[]
  similarity: number; interestScore: number; popularityScore: number
  freshnessScore: number; followingScore: number; totalScore: number
}
export interface RecommendationReport {
  user: { id: string; nickname: string }
  generatedAt: string; historyStart: string; candidateCount: number | string
  vectorNorm: number; coldStart: boolean; vector: RecommendationDimension[]
  articles: RankedArticle[]; steps: string[]
}
export const recommendationApi = {
  report: (userId: string) => get<RecommendationReport>(`/admin/v1/community/recommendations/${encodeURIComponent(userId)}`)
}
