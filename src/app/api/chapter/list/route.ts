// src\app\api\chapter\list

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


import { NextResponse } from "next/server";
import { getChapters } from "@/index";


export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Missing manga id" }, { status: 400 });
        }
        const limit = Number(searchParams.get("limit") ?? 100);
        const offset = Number(searchParams.get("offset") ?? 0);
        const lang = searchParams.get("lang") ?? "en";


        const { chapters, nextOffset } = await getChapters(id, { limit, offset, lang });
        return NextResponse.json({ chapters, nextOffset });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}