import mongoose from "mongoose";
import dns from "node:dns";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");
    } catch (error) {
        if (error?.code === "ECONNREFUSED" && error?.syscall === "querySrv") {
            try {
                dns.setServers(["8.8.8.8", "1.1.1.1"]);
                await mongoose.connect(process.env.MONGO_URI);
                console.log("Connected to MongoDB");
            } catch (retryError) {
                console.log(retryError);
            }
            return;
        }

        console.log(error);
    }
}
export default connectDB;
