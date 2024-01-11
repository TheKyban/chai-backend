class UserRefactor {
    constructor(user) {
        this._id = user._id;
        this.username = user.username;
        this.email = user.email;
        this.fullName = user.fullName;
        this.avatar = user.avatar;
        this.coverImage = user.coverImage;
        this.watchHistory = user.watchHistory;
        this.createdAt = user.createdAt;
        this.updatedAt = user.updatedAt;
    }
}

export { UserRefactor };
