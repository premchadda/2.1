import {
  calculateExamCountdown,
  generatePersonalizedRoadmap,
  simulateMilestoneTimeMachine,
} from "../services/core/studyRoadmapService.js";

describe("Candidate Personalized Study Roadmaps & Milestone Time Machine (Wave 17)", () => {
  it("should calculate exam countdown and urgency accurately", () => {
    // 60 days ahead
    const futureDate = new Date(Date.now() + 60 * 86400000)
      .toISOString()
      .slice(0, 10);
    const result = calculateExamCountdown(futureDate);

    expect(result.daysRemaining).toBe(60);
    expect(result.isUrgent).toBe(false);

    // 15 days ahead (urgent)
    const urgentDate = new Date(Date.now() + 15 * 86400000)
      .toISOString()
      .slice(0, 10);
    const urgentResult = calculateExamCountdown(urgentDate);

    expect(urgentResult.daysRemaining).toBe(15);
    expect(urgentResult.isUrgent).toBe(true);
  });

  it("should generate personalized roadmap with syllabus breakdown and milestones", async () => {
    const roadmap = await generatePersonalizedRoadmap("user-404", {
      examName: "SSC CGL Tier-1 2026",
      targetDate: new Date(Date.now() + 90 * 86400000)
        .toISOString()
        .slice(0, 10),
      baseAccuracy: 68.0,
    });

    expect(roadmap.userId).toBe("user-404");
    expect(roadmap.targetExam).toBe("SSC CGL Tier-1 2026");
    expect(roadmap.daysRemaining).toBe(90);
    expect(roadmap.totalEstimatedHours).toBeGreaterThan(150);
    expect(roadmap.totalCompletedHours).toBeGreaterThan(0);
    expect(roadmap.remainingHours).toBe(
      roadmap.totalEstimatedHours - roadmap.totalCompletedHours,
    );
    expect(roadmap.subjects.length).toBe(4);
    expect(roadmap.milestones).toHaveLength(4);

    const m1 = roadmap.milestones[0];
    expect(m1.id).toBe("m1");
    expect(m1.title).toContain("Foundation");
    expect(m1.targetDate).toBeDefined();
  });

  it("should simulate milestone time machine across 30, 45, 60, and 90 min/day scenarios", async () => {
    const roadmap = await generatePersonalizedRoadmap("user-404", {
      daysRemaining: 75,
      baseAccuracy: 70.0,
    });

    const simulation = simulateMilestoneTimeMachine(roadmap);

    expect(simulation.scenarios).toHaveLength(4);
    const [sc30, sc45, sc60, sc90] = simulation.scenarios;

    expect(sc30.dailyMinutes).toBe(30);
    expect(sc45.dailyMinutes).toBe(45);
    expect(sc60.dailyMinutes).toBe(60);
    expect(sc90.dailyMinutes).toBe(90);

    // More daily study minutes should yield earlier syllabus finish days and higher readiness
    expect(sc90.projectedCompletionDays).toBeLessThan(
      sc30.projectedCompletionDays,
    );
    expect(sc90.projectedAccuracy).toBeGreaterThan(sc30.projectedAccuracy);
    expect(sc90.readinessScore).toBeGreaterThanOrEqual(sc30.readinessScore);

    expect(simulation.recommendedPlan).toBeDefined();
    expect(simulation.recommendedPlan.dailyMinutes).toBeGreaterThanOrEqual(30);
    expect(simulation.recommendedPlan.readinessScore).toBeGreaterThan(0);
  });
});
