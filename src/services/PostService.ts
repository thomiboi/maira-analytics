import { prisma } from '@/lib/prisma'
import { Post, User } from '@prisma/client'

export type PostWithAuthor = Post & {
    author: User
}

export class PostService {
    static async getAllPosts(page = 1, limit = 10): Promise<{
        posts: PostWithAuthor[]
        total: number
        pages: number
        currentPage: number
    }> {
        const skip = (page - 1) * limit

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                skip,
                take: limit,
                include: {
                    author: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.post.count()
        ])

        return {
            posts,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        }
    }

    static async getPostsByAuthor(authorId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit

        const [posts, total] = await Promise.all([
            prisma.post.findMany({
                where: { authorId },
                skip,
                take: limit,
                include: {
                    author: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.post.count({
                where: { authorId }
            })
        ])

        return {
            posts,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        }
    }

    static async createPost(data: {
        title: string
        content?: string
        published?: boolean
        authorId: string
    }): Promise<Post> {
        return prisma.post.create({
            data
        })
    }

    static async updatePost(id: string, data: {
        title?: string
        content?: string
        published?: boolean
    }): Promise<Post> {
        return prisma.post.update({
            where: { id },
            data
        })
    }

    static async deletePost(id: string): Promise<Post> {
        return prisma.post.delete({
            where: { id }
        })
    }

    static async getPostById(id: string): Promise<PostWithAuthor | null> {
        return prisma.post.findUnique({
            where: { id },
            include: {
                author: true
            }
        })
    }

    static async getPostStats() {
        const [total, published, draft] = await Promise.all([
            prisma.post.count(),
            prisma.post.count({
                where: { published: true }
            }),
            prisma.post.count({
                where: { published: false }
            })
        ])

        return {
            total,
            published,
            draft
        }
    }
}
