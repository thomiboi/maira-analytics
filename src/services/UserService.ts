import { prisma } from '@/lib/prisma'
import { User, UserProfile } from '@prisma/client'

export type UserWithProfile = User & {
    profile: UserProfile | null
}

export class UserService {
    static async findByEmail(email: string): Promise<UserWithProfile | null> {
        return prisma.user.findUnique({
            where: { email },
            include: { profile: true }
        })
    }

    static async findById(id: string): Promise<UserWithProfile | null> {
        return prisma.user.findUnique({
            where: { id },
            include: { profile: true }
        })
    }

    static async createUser(data: {
        id: string
        email: string
    }): Promise<User> {
        return prisma.user.create({
            data: {
                id: data.id,
                email: data.email
            }
        })
    }

    static async updateUser(id: string, data: Partial<User>): Promise<User> {
        return prisma.user.update({
            where: { id },
            data
        })
    }

    static async createOrUpdateProfile(userId: string, data: {
        firstName?: string
        lastName?: string
        avatar?: string
        bio?: string
        phone?: string
    }): Promise<UserProfile> {
        return prisma.userProfile.upsert({
            where: { userId },
            update: data,
            create: {
                userId,
                ...data
            }
        })
    }

    static async getUserStats(userId: string) {
        const [postsCount, profile] = await Promise.all([
            prisma.post.count({
                where: { authorId: userId }
            }),
            prisma.userProfile.findUnique({
                where: { userId }
            })
        ])

        return {
            postsCount,
            hasProfile: !!profile,
            joinedAt: profile?.createdAt || null
        }
    }

    static async getAllUsers(page = 1, limit = 10) {
        const skip = (page - 1) * limit

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: limit,
                include: {
                    profile: true,
                    _count: {
                        select: {
                            posts: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.user.count()
        ])

        return {
            users,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        }
    }
}
