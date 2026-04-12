import supabase from "./supabase.js";

const form = document.getElementById("registerForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    // 🔹 Sign up user
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) {
        console.error("Auth error:", error);
        alert("Signup failed: " + error.message);
        return;
    }

    const user = data.user;

    if (!user) {
        alert("User not returned. Check Supabase auth settings.");
        return;
    }

    console.log("User created:", user.id);

    // 🔹 Insert into users table
    const { error: insertError } = await supabase
        .from("users")
        .insert([
            {
                user_id: user.id,
                username: name,
                email: email,
                role: role
            }
        ]);

    if (insertError) {
        console.error("Insert error:", insertError);
        alert("Insert failed: " + insertError.message);
        return;
    }

    alert("Account created successfully!");
    window.location.href = "login.html";
});