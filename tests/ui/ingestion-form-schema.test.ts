import { describe, it, expect } from "vitest";

import {
    ingestionFormSchema,
    jobFormSchema,
    proposalFormSchema,
    memberFormSchema
} from "@/lib/schemas/ingestion-form-schema";

// ---------- Helpers ----------

function validJob() {
    return {
        jobLink: "https://www.upwork.com/freelance-jobs/apply/Build-a-dashboard_~012345/",
        clientLocation: "US",
        clientReview: 4.5,
        clientReviewAmount: 12,
        clientTotalSpent: 50000,
        type: "fixedPrice" as const,
        skills: ["React", "TypeScript"],
        title: "Build a dashboard",
        text: "We need a developer to build a React dashboard..."
    };
}

function validProposal() {
    return {
        id: 67890,
        viewed: true,
        interview: true,
        offer: false,
        price: "500",
        agency: false,
        memberId: 111,
        text: "I have extensive experience building dashboards..."
    };
}

function validMember() {
    return {
        id: 111,
        name: "John Doe",
        agency: false,
        agencyName: undefined,
        talentBadge: "Top Rated Plus",
        jss: 95,
        location: "UA"
    };
}

// ---------- Job Form Schema ----------

describe("jobFormSchema", () => {
    it("accepts valid job data", () => {
        const result = jobFormSchema.safeParse(validJob());
        expect(result.success).toBe(true);
    });

    it("rejects job with empty title", () => {
        const result = jobFormSchema.safeParse({ ...validJob(), title: "" });
        expect(result.success).toBe(false);
    });

    it("accepts job with jobLink URL", () => {
        const result = jobFormSchema.safeParse(validJob());
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.jobLink).toBe("https://www.upwork.com/freelance-jobs/apply/Build-a-dashboard_~012345/");
        }
    });

    it("accepts job without jobLink", () => {
        const { jobLink, ...noLink } = validJob();
        const result = jobFormSchema.safeParse(noLink);
        expect(result.success).toBe(true);
    });

    it("rejects job with empty skills array", () => {
        const result = jobFormSchema.safeParse({ ...validJob(), skills: [] });
        expect(result.success).toBe(false);
    });

    it("rejects invalid project type", () => {
        const result = jobFormSchema.safeParse({ ...validJob(), type: "unknown" });
        expect(result.success).toBe(false);
    });

    it("coerces string numbers to numeric values", () => {
        const result = jobFormSchema.safeParse({
            ...validJob(),
            clientReview: "4.2",
            clientReviewAmount: "10",
            clientTotalSpent: "99999"
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.clientReview).toBe(4.2);
        }
    });
});

// ---------- Proposal Form Schema ----------

describe("proposalFormSchema", () => {
    it("accepts valid proposal data", () => {
        const result = proposalFormSchema.safeParse(validProposal());
        expect(result.success).toBe(true);
    });

    it("rejects proposal with empty text", () => {
        const result = proposalFormSchema.safeParse({ ...validProposal(), text: "" });
        expect(result.success).toBe(false);
    });

    it("rejects proposal with non-positive ID", () => {
        const result = proposalFormSchema.safeParse({ ...validProposal(), id: -1 });
        expect(result.success).toBe(false);
    });
});

// ---------- Member Form Schema ----------

describe("memberFormSchema", () => {
    it("accepts valid member data", () => {
        const result = memberFormSchema.safeParse(validMember());
        expect(result.success).toBe(true);
    });

    it("accepts member with only ID (selection mode)", () => {
        const result = memberFormSchema.safeParse({ id: 111 });
        expect(result.success).toBe(true);
    });

    it("accepts member without optional fields", () => {
        const { agencyName, talentBadge, name, location, jss, agency, ...required } = validMember();
        const result = memberFormSchema.safeParse(required);
        expect(result.success).toBe(true);
    });

    it("rejects member with jss over 100 when provided", () => {
        const result = memberFormSchema.safeParse({ ...validMember(), jss: 101 });
        expect(result.success).toBe(false);
    });

    it("accepts member with empty name in id-only mode", () => {
        const result = memberFormSchema.safeParse({ ...validMember(), name: "" });
        expect(result.success).toBe(true);
    });

    it("rejects member with non-positive id", () => {
        const result = memberFormSchema.safeParse({ id: 0 });
        expect(result.success).toBe(false);
    });
});

// ---------- Full Ingestion Form Schema ----------

describe("ingestionFormSchema", () => {
    it("accepts valid complete ingestion input", () => {
        const result = ingestionFormSchema.safeParse({
            job: validJob(),
            proposal: validProposal(),
            member: validMember()
        });
        expect(result.success).toBe(true);
    });

    it("rejects when job section is missing", () => {
        const result = ingestionFormSchema.safeParse({
            proposal: validProposal(),
            member: validMember()
        });
        expect(result.success).toBe(false);
    });

    it("rejects when proposal section is missing", () => {
        const result = ingestionFormSchema.safeParse({
            job: validJob(),
            member: validMember()
        });
        expect(result.success).toBe(false);
    });

    it("rejects when member section is missing", () => {
        const result = ingestionFormSchema.safeParse({
            job: validJob(),
            proposal: validProposal()
        });
        expect(result.success).toBe(false);
    });
});
