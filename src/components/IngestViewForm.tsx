"use client";

import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

interface IngestViewFormProps {
  pair: {
    processedProposalId: string;
    createdAt: number;
    job: {
      jobLink: string;
      title: string;
      clientLocation: string;
      clientReview: number;
      clientReviewAmount: number;
      clientTotalSpent: number;
      skills: string[];
      text: string;
      type: string;
    };
    proposal: {
      id: number;
      price: string;
      viewed: boolean;
      interview: boolean;
      offer: boolean;
      agency: boolean;
      text: string;
      memberId: number;
    };
    member: {
      id: number;
      name: string;
      location: string;
      jss: number;
      talentBadge: string;
      agency: boolean;
      agencyName: string;
    };
  };
}

export function IngestViewForm({ pair }: IngestViewFormProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Job-Proposal Pair Details</CardTitle>
            <CardDescription className="mt-1">
              Read-only view of a previously ingested pairing. 
              Ingested on {new Date(pair.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Job Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">1. Job Details</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Original Job Link</Label>
              <Input value={pair.job.jobLink || "N/A"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Input value={pair.job.type === "hourly/fixedPrice" ? "Hourly / Fixed Price" : pair.job.type === "fixedPrice" ? "Fixed Price" : "Hourly"} disabled />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Job Title</Label>
              <Input value={pair.job.title} disabled />
            </div>

            <div className="space-y-2">
              <Label>Client Location</Label>
              <Input value={pair.job.clientLocation} disabled />
            </div>
            <div className="space-y-2">
              <Label>Client Total Spent ($)</Label>
              <Input value={pair.job.clientTotalSpent.toString()} disabled />
            </div>
            <div className="space-y-2">
              <Label>Client Average Review</Label>
              <Input value={pair.job.clientReview.toString()} disabled />
            </div>
            <div className="space-y-2">
              <Label>Number of Reviews</Label>
              <Input value={pair.job.clientReviewAmount.toString()} disabled />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Required Skills</Label>
            <div className="flex flex-wrap gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
              {pair.job.skills.length > 0 ? (
                pair.job.skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)
              ) : (
                <span className="text-muted-foreground">No skills extracted</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Job Description</Label>
            <Textarea value={pair.job.text} disabled rows={8} className="resize-none disabled:opacity-80" />
          </div>
        </div>
        
        <div className="my-6 h-px w-full bg-border/60" />

        {/* Proposal Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">2. Proposal Details</h3>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
             <div className="space-y-2 lg:col-span-1">
              <Label>Proposal ID</Label>
              <Input value={pair.proposal.id.toString()} disabled />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Bid Price / Rate</Label>
              <Input value={pair.proposal.price} disabled />
            </div>
            <div className="space-y-2 lg:col-span-2 flex flex-col justify-end pb-0.5 gap-2">
               <Label className="invisible">Flags</Label>
               <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={pair.proposal.viewed ? "default" : "outline"} className="select-none px-3 py-1">Viewed</Badge>
                  <Badge variant={pair.proposal.interview ? "default" : "outline"} className="select-none px-3 py-1">Interview</Badge>
                  <Badge variant={pair.proposal.offer ? "default" : "outline"} className="select-none px-3 py-1">Offer</Badge>
                  <Badge variant={pair.proposal.agency ? "default" : "outline"} className="select-none px-3 py-1">Agency</Badge>
               </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Proposal Text / Cover Letter</Label>
            <Textarea value={pair.proposal.text} disabled rows={10} className="resize-none disabled:opacity-80" />
          </div>
        </div>

        <div className="my-6 h-px w-full bg-border/60" />

        {/* Member Section */}
        <div className="space-y-4">
           <h3 className="text-lg font-medium">3. Submitting Member</h3>
           
           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Member ID</Label>
              <Input value={pair.member.id.toString()} disabled />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={pair.member.name} disabled />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={pair.member.location} disabled />
            </div>
            <div className="space-y-2">
              <Label>Job Success Score (%)</Label>
              <Input value={pair.member.jss.toString()} disabled />
            </div>
            <div className="space-y-2">
              <Label>Talent Badge</Label>
              <Input value={pair.member.talentBadge || "None"} disabled />
            </div>
            <div className="space-y-2 lg:col-span-2">
               <Label>Agency Affiliation</Label>
               <div className="pt-2">
                 <Badge variant={pair.member.agency ? "default" : "outline"}>
                   {pair.member.agency ? `Yes (${pair.member.agencyName})` : "No"}
                 </Badge>
               </div>
            </div>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
