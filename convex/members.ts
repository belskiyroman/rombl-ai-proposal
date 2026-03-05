import { queryGeneric } from "convex/server";

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
