import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

/**
 * Lists distinct members from style_profiles, returning the latest profile
 * for each unique memberId (deduped by most-recent updatedAt).
 */
export const listMembers = queryGeneric({
    args: {},
    handler: async (ctx) => {
        const profiles = await ctx.db
            .query("style_profiles")
            .order("desc")
            .collect();

        const seen = new Map<number, {
            memberId: number;
            memberName: string;
            memberLocation: string;
            agency: boolean;
            agencyName?: string;
            talentBadge?: string;
            jss: number;
        }>();

        for (const profile of profiles) {
            if (!seen.has(profile.memberId)) {
                seen.set(profile.memberId, {
                    memberId: profile.memberId,
                    memberName: profile.memberName,
                    memberLocation: profile.memberLocation,
                    agency: profile.agency,
                    agencyName: profile.agencyName,
                    talentBadge: profile.talentBadge,
                    jss: profile.jss,
                });
            }
        }

        return Array.from(seen.values());
    }
});

/**
 * Creates a "stub" style_profile for a new member.
 * This makes the member immediately available in the listMembers query.
 * The stub uses empty/default values for AI analysis fields.
 */
export const createMember = mutationGeneric({
    args: {
        memberId: v.float64(),
        memberName: v.string(),
        memberLocation: v.string(),
        agency: v.boolean(),
        agencyName: v.optional(v.string()),
        talentBadge: v.optional(v.string()),
        jss: v.float64(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        await ctx.db.insert("style_profiles", {
            source: "manual",
            memberId: args.memberId,
            memberName: args.memberName,
            memberLocation: args.memberLocation,
            agency: args.agency,
            agencyName: args.agencyName,
            talentBadge: args.talentBadge,
            jss: args.jss,
            // Empty/default styling analysis fields
            writingStyleAnalysis: {
                formality: 5,
                enthusiasm: 5,
                keyVocabulary: [],
                sentenceStructure: "standard"
            },
            keyVocabulary: [],
            sentenceStructure: "standard",
            createdAt: now,
            updatedAt: now
        });
    }
});
