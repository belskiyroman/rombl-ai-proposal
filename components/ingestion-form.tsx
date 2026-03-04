"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import {
    ingestionFormSchema,
    pasteJsonSchema,
    type IngestionFormValues,
    type PasteJsonValues
} from "@/lib/schemas/ingestion-form-schema";
import type { ExtractionResultsData } from "@/components/extraction-results";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// ---------- Types ----------

interface IngestionFormProps {
    onSuccess: (data: ExtractionResultsData) => void;
}

// ---------- Helpers ----------

/** Controlled checkbox-like toggle using a hidden input + visual badge. */
function BooleanToggle({
    label,
    value,
    onChange
}: {
    label: string;
    value: boolean;
    onChange: (val: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className="inline-flex items-center gap-1.5"
        >
            <Badge variant={value ? "default" : "secondary"} className="cursor-pointer select-none">
                {label}: {value ? "Yes" : "No"}
            </Badge>
        </button>
    );
}

/** Error message beneath a field. */
function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="text-sm text-destructive mt-1">{message}</p>;
}

// ---------- Default Values ----------

const defaultValues: IngestionFormValues = {
    job: {
        id: 0,
        clientLocation: "",
        clientReview: 0,
        clientReviewAmount: 0,
        clientTotalSpent: 0,
        type: "fixedPrice",
        skills: [],
        title: "",
        text: ""
    },
    proposal: {
        id: 0,
        jobId: 0,
        viewed: false,
        interview: false,
        offer: false,
        price: "",
        agency: false,
        memberId: 0,
        text: ""
    },
    member: {
        id: 0,
        name: "",
        agency: false,
        agencyName: "",
        talentBadge: "",
        jss: 0,
        location: ""
    }
};

// ---------- Component ----------

export function IngestionForm({ onSuccess }: IngestionFormProps) {
    const [mode, setMode] = useState<"form" | "json">("form");
    const [skillInput, setSkillInput] = useState("");

    const ingestAction = useAction(api.jobs.ingestJobProposalPair);

    const form = useForm<IngestionFormValues>({
        resolver: zodResolver(ingestionFormSchema),
        defaultValues
    });

    const jsonForm = useForm<PasteJsonValues>({
        resolver: zodResolver(pasteJsonSchema),
        defaultValues: { rawJson: "" }
    });

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors, isSubmitting }
    } = form;

    // ---------- Skills management ----------

    const skills = watch("job.skills");

    function addSkill() {
        const trimmed = skillInput.trim();
        if (trimmed && !skills.includes(trimmed)) {
            setValue("job.skills", [...skills, trimmed]);
            setSkillInput("");
        }
    }

    function removeSkill(skill: string) {
        setValue(
            "job.skills",
            skills.filter((s) => s !== skill)
        );
    }

    // ---------- Submit handlers ----------

    async function onFormSubmit(data: IngestionFormValues) {
        try {
            const result = await ingestAction({
                source: "manual",
                job: data.job,
                proposal: data.proposal,
                member: data.member
            });

            toast.success("Ingestion successful", {
                description: `Created job record, style profile, and processed proposal.`
            });

            onSuccess({
                rawJobId: result.rawJobId,
                styleProfileId: result.styleProfileId,
                processedProposalId: result.processedProposalId,
                executionTrace: result.executionTrace
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error("Ingestion failed", { description: message });
        }
    }

    async function onJsonSubmit(data: PasteJsonValues) {
        try {
            const parsed = JSON.parse(data.rawJson);
            const validated = ingestionFormSchema.parse(parsed);

            // Populate the standard form with parsed values so the user can review
            form.reset(validated);
            setMode("form");
            toast.info("JSON parsed successfully", {
                description: "Review the fields and click Submit."
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid JSON";
            toast.error("JSON parse error", { description: message });
        }
    }

    // ---------- Render ----------

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Ingest Job-Proposal Pair</CardTitle>
                        <CardDescription className="mt-1">
                            Enter the historical Job, Proposal, and Member data to analyze and store.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={mode === "form" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMode("form")}
                        >
                            Form
                        </Button>
                        <Button
                            type="button"
                            variant={mode === "json" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMode("json")}
                        >
                            Paste JSON
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* ---------- JSON Mode ---------- */}
                {mode === "json" && (
                    <form onSubmit={jsonForm.handleSubmit(onJsonSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="rawJson">Paste full JSON payload</Label>
                            <Textarea
                                id="rawJson"
                                rows={16}
                                placeholder={'{\n  "job": { ... },\n  "proposal": { ... },\n  "member": { ... }\n}'}
                                className="mt-1.5 font-mono text-sm"
                                {...jsonForm.register("rawJson")}
                            />
                            <FieldError message={jsonForm.formState.errors.rawJson?.message} />
                        </div>
                        <Button type="submit" className="w-full">
                            Parse & Load into Form
                        </Button>
                    </form>
                )}

                {/* ---------- Form Mode ---------- */}
                {mode === "form" && (
                    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
                        <Tabs defaultValue="job" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="job">Job</TabsTrigger>
                                <TabsTrigger value="proposal">Proposal</TabsTrigger>
                                <TabsTrigger value="member">Member</TabsTrigger>
                            </TabsList>

                            {/* -------- Job Tab -------- */}
                            <TabsContent value="job" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="job.id">Job ID</Label>
                                        <Input id="job.id" type="number" {...register("job.id")} />
                                        <FieldError message={errors.job?.id?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="job.clientLocation">Client Location</Label>
                                        <Input id="job.clientLocation" placeholder="US" {...register("job.clientLocation")} />
                                        <FieldError message={errors.job?.clientLocation?.message} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="job.clientReview">Client Review (0–5)</Label>
                                        <Input id="job.clientReview" type="number" step="0.1" {...register("job.clientReview")} />
                                        <FieldError message={errors.job?.clientReview?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="job.clientReviewAmount">Review Count</Label>
                                        <Input id="job.clientReviewAmount" type="number" {...register("job.clientReviewAmount")} />
                                        <FieldError message={errors.job?.clientReviewAmount?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="job.clientTotalSpent">Total Spent ($)</Label>
                                        <Input id="job.clientTotalSpent" type="number" step="0.01" {...register("job.clientTotalSpent")} />
                                        <FieldError message={errors.job?.clientTotalSpent?.message} />
                                    </div>
                                </div>

                                <div>
                                    <Label>Project Type</Label>
                                    <Select
                                        value={watch("job.type")}
                                        onValueChange={(val) =>
                                            setValue("job.type", val as IngestionFormValues["job"]["type"])
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hourly">Hourly</SelectItem>
                                            <SelectItem value="fixedPrice">Fixed Price</SelectItem>
                                            <SelectItem value="hourly/fixedPrice">Hourly / Fixed Price</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FieldError message={errors.job?.type?.message} />
                                </div>

                                <div>
                                    <Label htmlFor="job.title">Job Title</Label>
                                    <Input id="job.title" {...register("job.title")} />
                                    <FieldError message={errors.job?.title?.message} />
                                </div>

                                {/* Skills tag input */}
                                <div>
                                    <Label>Skills</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            value={skillInput}
                                            onChange={(e) => setSkillInput(e.target.value)}
                                            placeholder="Add skill and press Enter"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addSkill();
                                                }
                                            }}
                                        />
                                        <Button type="button" variant="secondary" onClick={addSkill}>
                                            Add
                                        </Button>
                                    </div>
                                    {skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {skills.map((s) => (
                                                <Badge
                                                    key={s}
                                                    variant="secondary"
                                                    className="cursor-pointer"
                                                    onClick={() => removeSkill(s)}
                                                >
                                                    {s} ×
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    <FieldError message={errors.job?.skills?.message} />
                                </div>

                                <div>
                                    <Label htmlFor="job.text">Job Description</Label>
                                    <Textarea
                                        id="job.text"
                                        rows={8}
                                        placeholder="Full job description..."
                                        {...register("job.text")}
                                    />
                                    <FieldError message={errors.job?.text?.message} />
                                </div>
                            </TabsContent>

                            {/* -------- Proposal Tab -------- */}
                            <TabsContent value="proposal" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="proposal.id">Proposal ID</Label>
                                        <Input id="proposal.id" type="number" {...register("proposal.id")} />
                                        <FieldError message={errors.proposal?.id?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="proposal.jobId">Job ID (ref)</Label>
                                        <Input id="proposal.jobId" type="number" {...register("proposal.jobId")} />
                                        <FieldError message={errors.proposal?.jobId?.message} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="proposal.price">Price</Label>
                                        <Input id="proposal.price" placeholder="500.00" {...register("proposal.price")} />
                                        <FieldError message={errors.proposal?.price?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="proposal.memberId">Member ID (ref)</Label>
                                        <Input id="proposal.memberId" type="number" {...register("proposal.memberId")} />
                                        <FieldError message={errors.proposal?.memberId?.message} />
                                    </div>
                                </div>

                                {/* Boolean toggles */}
                                <div className="flex flex-wrap gap-4">
                                    <BooleanToggle
                                        label="Viewed"
                                        value={watch("proposal.viewed")}
                                        onChange={(v) => setValue("proposal.viewed", v)}
                                    />
                                    <BooleanToggle
                                        label="Interview"
                                        value={watch("proposal.interview")}
                                        onChange={(v) => setValue("proposal.interview", v)}
                                    />
                                    <BooleanToggle
                                        label="Offer"
                                        value={watch("proposal.offer")}
                                        onChange={(v) => setValue("proposal.offer", v)}
                                    />
                                    <BooleanToggle
                                        label="Agency"
                                        value={watch("proposal.agency")}
                                        onChange={(v) => setValue("proposal.agency", v)}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="proposal.text">Proposal Text</Label>
                                    <Textarea
                                        id="proposal.text"
                                        rows={8}
                                        placeholder="Full proposal text..."
                                        {...register("proposal.text")}
                                    />
                                    <FieldError message={errors.proposal?.text?.message} />
                                </div>
                            </TabsContent>

                            {/* -------- Member Tab -------- */}
                            <TabsContent value="member" className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="member.id">Member ID</Label>
                                        <Input id="member.id" type="number" {...register("member.id")} />
                                        <FieldError message={errors.member?.id?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="member.name">Name</Label>
                                        <Input id="member.name" {...register("member.name")} />
                                        <FieldError message={errors.member?.name?.message} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="member.location">Location</Label>
                                        <Input id="member.location" placeholder="UA" {...register("member.location")} />
                                        <FieldError message={errors.member?.location?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="member.jss">JSS (0–100)</Label>
                                        <Input id="member.jss" type="number" {...register("member.jss")} />
                                        <FieldError message={errors.member?.jss?.message} />
                                    </div>
                                    <div>
                                        <Label htmlFor="member.talentBadge">Talent Badge</Label>
                                        <Input id="member.talentBadge" placeholder="Top Rated Plus" {...register("member.talentBadge")} />
                                        <FieldError message={errors.member?.talentBadge?.message} />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 items-center">
                                    <BooleanToggle
                                        label="Agency"
                                        value={watch("member.agency")}
                                        onChange={(v) => setValue("member.agency", v)}
                                    />
                                </div>

                                {watch("member.agency") && (
                                    <div>
                                        <Label htmlFor="member.agencyName">Agency Name</Label>
                                        <Input id="member.agencyName" {...register("member.agencyName")} />
                                        <FieldError message={errors.member?.agencyName?.message} />
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        {/* Submit */}
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Ingesting…
                                </>
                            ) : (
                                "Submit Ingestion"
                            )}
                        </Button>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
