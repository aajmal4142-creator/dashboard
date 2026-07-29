export interface DataQualityAssessment {
  completeness: number;
  accuracy: number;
  consistency: number;
  recency: number;
  overallScore: number;
  breakdown: {
    completeness: {
      score: number;
      details: string;
    };
    accuracy: {
      score: number;
      details: string;
    };
    consistency: {
      score: number;
      details: string;
    };
    recency: {
      score: number;
      details: string;
    };
  };
}

export interface DataQualityInput {
  totalDataPoints: number;
  estimatedDataPoints: number;
  primaryDataPercentage: number;
  dataSourcesDocumented: number;
  totalDataSources: number;
  dataAgeInMonths: number;
  inconsistenciesFound: number;
  recordsVerified: number;
  totalRecords: number;
  methodologyDocumented: boolean;
  qualityReviewCompleted: boolean;
}

export function assessDataQuality(input: DataQualityInput): DataQualityAssessment {
  // Completeness: ratio of documented to total data sources, plus primary data percentage
  const completenessScore = Math.round(
    (input.dataSourcesDocumented / input.totalDataSources) * 50 +
    input.primaryDataPercentage * 0.5
  );

  // Accuracy: based on verification rate
  const verificationRate = input.recordsVerified / input.totalRecords;
  const accuracyScore = Math.round(verificationRate * 100);

  // Consistency: based on no inconsistencies found
  const inconsistencyRate = input.inconsistenciesFound / input.totalDataPoints;
  const consistencyScore = Math.round((1 - Math.min(inconsistencyRate, 1)) * 100);

  // Recency: data should be from current year, score decreases with age
  let recencyScore = 100;
  if (input.dataAgeInMonths > 12) {
    recencyScore = Math.max(0, 100 - (input.dataAgeInMonths - 12) * 5);
  }

  const overallScore = Math.round(
    (completenessScore + accuracyScore + consistencyScore + recencyScore) / 4
  );

  return {
    completeness: completenessScore,
    accuracy: accuracyScore,
    consistency: consistencyScore,
    recency: recencyScore,
    overallScore,
    breakdown: {
      completeness: {
        score: completenessScore,
        details: `${input.dataSourcesDocumented}/${input.totalDataSources} sources documented, ${input.primaryDataPercentage}% primary data`,
      },
      accuracy: {
        score: accuracyScore,
        details: `${input.recordsVerified}/${input.totalRecords} records verified (${verificationRate.toFixed(1)}%)`,
      },
      consistency: {
        score: consistencyScore,
        details: `${input.inconsistenciesFound} inconsistencies found in ${input.totalDataPoints} data points`,
      },
      recency: {
        score: recencyScore,
        details: `Data is ${input.dataAgeInMonths} months old${
          input.methodologyDocumented ? ", methodology documented" : ""
        }`,
      },
    },
  };
}

export function generateDataQualityNarrative(assessment: DataQualityAssessment): string {
  const parts: string[] = [];

  parts.push("### Data Quality Assessment\n");
  parts.push(
    `The organization's GHG emissions data quality has been assessed and rated at **${assessment.overallScore}%** overall.\n`
  );

  parts.push("#### Completeness");
  parts.push(`Score: ${assessment.completeness}%`);
  parts.push(`${assessment.breakdown.completeness.details}\n`);

  parts.push("#### Accuracy");
  parts.push(`Score: ${assessment.accuracy}%`);
  parts.push(`${assessment.breakdown.accuracy.details}\n`);

  parts.push("#### Consistency");
  parts.push(`Score: ${assessment.consistency}%`);
  parts.push(`${assessment.breakdown.consistency.details}\n`);

  parts.push("#### Recency");
  parts.push(`Score: ${assessment.recency}%`);
  parts.push(`${assessment.breakdown.recency.details}\n`);

  if (assessment.overallScore >= 80) {
    parts.push("**Assessment:** Data quality is **high** and suitable for assurance audit.\n");
  } else if (assessment.overallScore >= 60) {
    parts.push(
      "**Assessment:** Data quality is **acceptable** but areas for improvement exist. Address identified gaps before assurance.\n"
    );
  } else {
    parts.push(
      "**Assessment:** Data quality is **concerning**. Significant improvements needed before audit-ready status.\n"
    );
  }

  return parts.join("\n");
}

export function getDataQualityRating(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Acceptable";
  if (score >= 60) return "Fair";
  return "Poor";
}
