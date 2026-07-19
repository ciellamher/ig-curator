import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Client } from "@notionhq/client";

// Initialize Notion Client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }
    
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { message: "Password must contain both letters and numbers" },
        { status: 400 }
      );
    }

    const safeUsername = username.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: safeUsername }
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Username is already taken" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: safeUsername,
        password: hashedPassword,
        name: username
      }
    });

    // --- Notion Integration ---
    try {
      if (process.env.NOTION_DATABASE_ID && process.env.NOTION_API_KEY) {
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_DATABASE_ID },
          properties: {
            // "title" property must match the actual name of your title column in Notion (usually "Name", but we will try "Username" first if it was renamed, or fallback to default behavior)
            // Notion usually requires the title property to be explicitly typed as "title".
            // If the database has a column with title type (the primary column), we must use its actual name or ID. 
            // In most Notion databases, the first column is named "Name" and is of type title. Let's use "Username" since we instructed the user to rename it, but to be safe, Notion title properties can also be created by just supplying the actual property name. 
            // Actually, if we use the property name "Username", it will map to it. If it fails, we will catch it.
            Username: {
              title: [
                {
                  text: {
                    content: username,
                  },
                },
              ],
            },
          },
        });
      }
    } catch (notionError) {
      console.error("Failed to add user to Notion database:", notionError);
      // We don't want to fail the whole registration if Notion is down or misconfigured
    }

    return NextResponse.json(
      { message: "User registered successfully", user: { id: user.id, username: user.name } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
